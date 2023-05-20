---
slug: 2018/07/mach-o-linking-and-loading-tricks.html
title: Mach-O linking and loading tricks
authors: [bugaevc]
tags: [mach-o, linking]
---

*(A translation of this post into Russian is available at https://habr.com/post/417507/)*

The goal of the Darling Project is to make it possible to run macOS apps under Linux, and being able to load Mach-O binaries is a crucial step in achieving that.

<!-- truncate -->

Early in its history, Darling was built around a custom Mach-O loader and the idea of bridging high-level Darwin APIs to their Linux counterparts. Since then, our focus has shifted to running code in an increasingly isolated Darwin container; since the [Mach-O transition](../../../../2017/02/06/mach-o-transition/index.md), we're able to use Apple's original dyld, as well as build many other open-source parts of Darwin. We still maintain a simple Mach-O loader that is used to load dyld itself.

Mach-O, along with Mach itself, are, perhaps, the most distinguishing features of Darwin, and various frameworks and libraries that Apple ships make extensive use of the various obscure features Mach-O provides. This makes dealing with Mach-Os one of the most important and prominent parts of Darling development. From implementing our own Mach-O loaders to building parts of Darwin, initially as tricky ELFs, and now as real Mach-Os, we have to understand Mach-O internals on a much deeper level than it's normally necessary for regular developers who target Darwin.

Without further ado, let's discuss some of the tricks Mach-O has to offer.

## Install names

On Windows and Linux, dynamic libraries are referenced by their names (e.g. `libc.so`), and it's a job of the dynamic linker to look for a library with a matching name in a list of standard library paths. In contrast, on Darwin, the (somewhat) complete path to the library installation, known as that library's *install name*, is used. This has presumably been done that way in order to prevent *dylib hijacking*, an attack where a malicious dylib gets placed in the library search path before the real one, which allows the malicious dylib to execute arbitrary code on the behalf of the executable that got tricked into loading it.

Not only do executables and libraries list full install names of their dependencies, but the dependency Mach-Os themselves "know" their own install name. This is, in fact, how the linker knows what install names to use for the dependencies: it reads them from the dependency libraries themselves.

When linking a dylib, you specify its install name using `-install_name` or `-dylib_install_name` ld options:

```bash
$ ld -o libfoo.dylib foo.o -install_name /usr/local/lib/libfoo.dylib
```

Now, when you link another Mach-O file, say, `libbar.dylib` against `libfoo.dylib`, ld is going to record `libfoo`'s install name, `/usr/local/lib/libfoo.dylib`, in `libbar`'s list of dependencies, and that's the path where dyld will look for `libfoo` at runtime.

While specifying the full path works reasonably well for system libraries that are indeed placed in well-known locations in the file system, libraries that get shipped inside app bundles present a problem because, while each app could assume it's going to be installed at `/Applications/AppName.app`, app bundles are meant to be portable and relocatable, so the exact path to the libraries inside of them cannot be known in advance.

Darwin's solution to this problem is allowing install names to start with `@executable_path`, `@loader_path`, or `@rpath`&mdash;that is, to be relative to the main executable path, "loader" (the executable or library that directly depends on this library) path, or a list of paths defined by the main executable, respectively&mdash;instead of always requiring them to be absolute paths. The first two just work, but if any of your dependencies (or their transitive dependencies) have `@rpath`-relative install names, you have to explicitly specify `@rpath` when linking your executable by using ld's `-rpath` option as many times as you need:

```bash
$ ld -o runme -rpath @executable_path/../Frameworks -rpath @executable_path/../bin/lib
```

:::note

The concept of rpath somewhat defies the original idea of well-known dylib locations and [allows](https://www.virusbulletin.com/virusbulletin/2015/03/dylib-hijacking-os-x) dylib hijacking attacks to be carried out, arguably rendering the whole topic of install names pretty useless.

:::

## Circular dependencies

When a projects spans several files, it's normal for them to have circular interdependencies. This works fine as long as all these files get compiled into a single binary, either a library or an executable. What does not work is having several dynamic libraries depend on each other.

You might argue that instead of using circular dependencies between dynamic libraries one should better reconsider the architecture of what they're building, and you won't be wrong. But if there's one typical thing about Apple, it's that they never take their time to reconsider and do things the right way, they prefer to just keep piling hacks and tricks on top of each other. In particular, we need to make circular dependencies work in Darling because various `libSystem` sub-libraries such as `libsystem_dyld`, `libsystem_kernel` and `libsystem_pthread` all depend on each other. (Until recently, we've also had to circularily link Cocoa frameworks such as AppKit, Core Graphics and Core OpenGL because of the way The Cocotron's Core OpenGL is implemented, but we've [re-architectured](https://github.com/darlinghq/darling/issues/365) our Core OpenGL implementation and got rid of this circular dependency.)

Fundamentally, there's nothing wrong with circular dependencies: the dynamic linker already knows to load each library only once, so it won't fall into infinite recursion. The problem is, there's no direct way to *link* such libraries, because one linker invocation only produces one library, and when linking any binary we have to pass its dependencies, all already linked, to the linker. We have to link one of our libraries first, and at that moment others are not yet ready, so we can't pass them to the linker.

The trick here is to link some (or all, for simplicity) of the libraries *twice*. The first time, tell the linker to ignore any missing dependencies and indeed pass no dependencies:

```bash
$ ld -o libfoo.dylib foo.o -flat_namespace -undefined suppress
$ ld -o libbar.dylib bar.o -flat_namespace -undefined suppress
```

:::info

See below for what `-flat_namespace` does.

:::

Of course, if you try to use these resulting dylibs directly, you'll get dynamic linking errors at runtime. Instead, you re-link the libraries the second time, passing the resulting dylibs as dependencies:

```bash
$ ld -o libfoo.dylib foo.o libbar.dylib
$ ld -o libbar.dylib bar.o libfoo.dylib
```

This time, the linker is able to see all the symbols, so we don't tell it to ignore errors (and if some symbols are indeed missing, you'll get an error).

Even though some, if not all, of the libraries get linked to the "wrong" copies of their dependency dylibs, at runtime dyld is going to see the correct ones. For this to work, you have to make sure both copies of each library have the same install name.

One last detail is initialization order. Any code can define initializer functions using `__attribute__((constructor))` compiler magic (the list of such initializers ends up in the `__mod_init_func` section inside a Mach-O file). These functions are invoked by dyld upon loading the binary they reside in, before `main()` is invoked. Normally, each library's initializers are run after running initializers of its dependencies, so each initializer can rely on the dependency libraries already having been set up and thus being ready to work. This guarantee clearly cannot be provided for circular dependencies; dyld will run their initializers in *some* order. You can mark dependencies as *upward dependencies* to customize that order; dyld will initialize libraries that somebody marked as their upward dependency last. So, to force `libfoo` to be initialized after `libbar`, link them like so:

```bash
$ ld -o libfoo.dylib foo.o libbar.dylib
$ ld -o libbar.dylib bar.o -upward_library libfoo.dylib
```

To make all of this convenient, in Darling we have a CMake function named [`add_circular`](https://github.com/darlinghq/darling/blob/master/cmake/darling_lib.cmake#L116-L172) that does all the hard work and allows its callers to be as simple and as declarative as:

```cmake
set(DYLIB_INSTALL_NAME "/usr/lib/system/libdispatch.dylib")
add_circular(libdispatch_shared FAT
	SOURCES
		${dispatch_SRCS}
	SIBLINGS
		system_c
		system_kernel
		system_malloc
		system_blocks
		system_pthread
		system_dyld
		system_duct
		unwind
		platform
		compiler_rt
	UPWARD
		objc
)
```

## Two-level symbol namespace

Mach-O symbol tables don't just store symbol names, they also "remember" what library (or executable) each symbol comes from. In other words, symbol names are namespaced by the name of the binary that defines them, hence, "two-level namespace", the other level being symbol names themselves.

Two-level namespace [was introduced](http://mirror.informatimago.com/next/developer.apple.com/releasenotes/DeveloperTools/TwoLevelNamespaces.html) to prevent symbol name clashes. Normally, multiple libraries defining symbols with the same name would result in link-time errors; but this doesn't necessarily work when loading libraries at runtime (think plugins) or when different library versions are present at link-time and runtime. This is not a problem with libraries that use two-level namespace, as it enables multiple libraries to define the same symbol name without any conflicts.

Two-level namespace can be turned off, reverting to a "flat namespace" (one reason for doing this is that using two-level namespace implies that each symbol needs to be resolved at link time, so using `-undefined_suppress` requires a flat namespace, as we've seen above). ld has two flags that allow you to disable two-level namespace at link time: `-flat_namespace`, which only affects one Mach-O file, and `-force_flat_namespace`, which only works for executables, not libraries, and causes the whole process to use a flat namespace. You can also force dyld to use a flat namespace at runtime by setting the `DYLD_FORCE_FLAT_NAMESPACE` environment variable.

One caveat with using two-level namespace is that you always have to explicitly link each Mach-O to all the libraries or framework it depends on. So for example, if you link to AppKit, you cannot just use Foundation, you have to explicitly link to it as well. Another is that, as a library or framework author, you cannot freely move a symbol implementation "down" the dependency chain, as you might be used to be able to (e.g. it's not possible to just move code from AppKit to Foundation). To make that possible, Mach-O, ld, and dyld provide a few additional features, namely, *sub-libraries*, *reexporting symbols*, and *meta-symbols*.

## Sub-libraries

Sub-libraries is a mechanism that allows one library (called *facade* or *umbrella* library) to delegate the implementation of some of its functionality to another library (called its *sub-library*); or, if you look at it another way, it allows a library to publicly reexport symbols provided by another library.

The primary use-case for this feature is once again `libSystem` with its sub-libraries that reside in `/usr/lib/system`, but it can be used with any pair of libraries:

```bash
$ ld -o libfoo.dylib foo.o -lobjc -sub_library libobjc
# or:
$ ld -o libfoo.dylib foo.o -reexport-lobjc
```

The only difference this makes compared to just linking to that library is that a `LC_REEXPORT_DYLIB` command gets emitted instead of the usual `LC_LOAD_DYLIB` (in particular, symbols from the sub-library do not get copied into the umbrella library at link time, so it doesn't even have to be relinked in case new symbols are latter added to the sub-library). At runtime `LC_REEXPORT_DYLIB` works similarly to `LC_LOAD_DYLIB` too: dyld will load in the sub-library and make its symbols available for others (but unlike with `LC_LOAD_DYLIB`, the symbols will appear to come from the umbrella library as far as the two-level namespace is concerned).

What is really different about `LC_REEXPORT_DYLIB` is how ld behaves when you link *another* library against `libfoo`: instead of just looking for symbols in all the object and dylib files it's been given, ld will also open and inspect the reexported sub-library (`libobjc` in this example).

How does it know where to look? The only thing recorded in `libfoo.dylib` is `libobjc.dylib`'s install name, so that's where ld expects to find it. This means a library has to be installed in its proper place before you can use it as a sub-library for anything else; that works fine for system libraries like `libobjc`, but can be very inconvenient or plain impossible if you're trying to reexport a custom sub-library.

To solve this problem, ld provides a `-dylib_file` option that allows you to specify a custom dylib location for ld to use at link time:

```bash
$ ld -o libfoo.dylib foo.o -reexport_library /path/to/libsubfoo.dylib
$ ld -o libbar.dylib bar.o libfoo.dylib -dylib_file \
    @executable_path/lib/foo/libsubfoo.dylib:/path/to/libsubfoo.dylib
```

Despite `libSystem` and some other system libraries reexporting their sub-libraries, you don't see `-dylib_file` being used for linking every single executable on macOS; this is because the system libraries are already installed in the location matching their install name. When building Darling on Linux, however, we have to pass a number of `dylib_file` path mappings (along with other common arguments) to each ld invocation, which we do with a [custom function](https://github.com/darlinghq/darling/blob/master/cmake/use_ld64.cmake) that automatically gets applied when using `add_darling_library`, `add_darling_executable`, or others.

## Reexporting symbols

Sometimes a library needs to reexport some symbols, but not outright everything, from another library. For example, Core Foundation reexports `NSObject`, which is nowadays implemented inside the Objective-C runtime, for compatibility reasons.

:::tip

If you're wondering why `NSObject` was ever in Core Foundation instead of Foundation, it's because the way toll-free bridging is implemented, private classes wrapping Core Foundation types (e.g. `__NSCFString`) have to reside in Core Foundation, but being Objective-C objects, they still need to inherit from `NSObject`. Perhaps, another way this could have been implemented is leaving `NSObject` with all of its descendants in Foundation and circularly linking Core Foundation to Foundation, but Apple has opted to move the private toll-free bridging helper classes along with `NSObject` into Core Foundation, and we do the same thing in Darling in order to stay compatible.

:::

You can pass a list of symbols to reexport to ld using its `-reexported_symbols_list` option:

```bash
$ echo .objc_class_name_NSObject > reexport_list.exp
$ ld -o CoreFoundation CFFiles.o -lobjc -reexported_symbols_list reexport_list.exp
```

Even though reexporting *some* symbols sounds very similar to reexporting *all* symbols, the mechanism this is implemented with is very different from how sub-libraries work. No special `LC_*_DYLIB` command gets emitted; instead, a special *indirect symbol* (designated by `N_INDIR` flag) is inserted into the nametable, and it behaves as a symbol provided by this library. If the library itself uses the symbol, it results in a *second* "undefined" copy of the symbol in the name table (just as it happens when reexports are not involved).

There is one important detail to explicitly naming reexported symbols, which is that you're likely to want to reexport different symbol names for different architectures. As a matter of fact, Objective-C name mangling convention and ABI differ between i386 and x86-64, so on i386 you have to reexport just `.objc_class_name_NSObject`, whereas on x86-64 it's `_OBJC_CLASS_$_NSObject`, `_OBJC_IVAR_$_NSObject.isa` and `_OBJC_METACLASS_$_NSObject`. This is not a concern when using sub-libraries, as all available symbols for each architecture get reexported automatically.

Most tools working with Mach-Os handle "fat", or universal, binaries (ones that contain sub-Mach-Os for several architectures) transparently. Clang can build universal binaries with all the requested architectures, dyld chooses what architecture to load from a dylib based on what architectures the executable supports, and tools like ld, otool and nm work with the host (i.e. x86-64) architecture, unless explicitly overridden with a flag. The only thing that actually reminds you there are multiple architectures being processed is that you get compile errors and warnings twice, once for each architecture.

Having to provide two different reexport lists breaks the illusion. There's no built-in option in ld to use different lists for different architectures, which means we have to link dylibs for each architecture separately and then combine them using lipo:

```bash
$ ld -o CF_i386.dylib CFFiles.o -arch i386 -lobjc -reexported_symbols_list reexport_i386.exp
$ ld -o CF_x86-64.dylib CFFiles.o -arch x86_64 -lobjc -reexported_symbols_list reexport_x86_64.exp
$ lipo -arch i386 CF_i386.dylib -arch x86_64 CF_x86-64.dylib -create -output CoreFoundation
```

In Darling, we use a CMake function named [`add_separated_framework`](https://github.com/darlinghq/darling/blob/master/cmake/darling_framework.cmake#L125-L357) that abstracts separated linking and running lipo, so the real CMake script for building Core Foundation [looks like this](https://github.com/darlinghq/darling-corefoundation/blob/master/CMakeLists.txt):

```cmake
add_separated_framework(CoreFoundation
	CURRENT_VERSION
	SOURCES
		${cf_sources}
	VERSION "A"
	DEPENDENCIES
		objc
		system
		icucore
	LINK_FLAGS
		# ...misc common flags here
)
set_property(TARGET CoreFoundation_i386 APPEND_STRING PROPERTY
	LINK_FLAGS " -Wl,-reexported_symbols_list,${CMAKE_CURRENT_SOURCE_DIR}/reexport_i386.exp")
set_property(TARGET CoreFoundation_x86_64 APPEND_STRING PROPERTY
	LINK_FLAGS " -Wl,-reexported_symbols_list,${CMAKE_CURRENT_SOURCE_DIR}/reexport_x86_64.exp")
```

## Meta-symbols

Meta-symbols is yet another feature designed to allow Apple to move symbols and libraries around without breaking old code.

When building a Mach-O file, you should always specify the earliest version of macOS it supports by using the `-mmacosx-version-min=10.x` compiler option (or similar options for iOS, tvOS, watchOS, and whatever other OS names Apple comes up with for its products in the future). This option controls multiple things; for instance, it activates or deactivates various availability macros like `AVAILABLE_MAC_OS_X_VERSION_10_13_AND_LATER` and switches between `libstdc++` (GNU version) and `libc++` (LLVM version) for the C++ standard library implementation. For this post, we'll focus on what effect it has on the linker and the produced Mach-O. In particular, ld has a `-macosx_version_min` option of its own (note the underscores and the lack of an extra m) that makes it emit a `LC_VERSION_MIN_MACOSX` Mach-O command (to signal dyld to error out if the file is being loaded on an earlier OS version).

But in addition to that, passing `-macosx_version_min` to ld also changes what meta-symbols of *other* Mach-O files are taken into account. Meta-symbols are symbols that have names starting with `$ld$`, and ld has a special code path for when it encounters such a symbol: it gets treated as an additional command rather than as a symbol. Its name must be of the form `$ld$action$condition$name`. Here, `condition` looks like os10.5 and defines what OS version this meta-symbol is for&mdash;to be more specific, this symbol will only have any effect if the declared "*min* OS version" of the Mach-O being linked is *equal* to the version specified by the symbol; `action` can be either `add`, `hide`, `install_name`, or `compatibility_version`, causing ld to pretend to see or not see a symbol with the given name, override the install name or the compatibility version (see below) of the library to the one specified in name, respectively.

Since `condition` cannot specify a version range, you're likely to see the same action repeated many times for different OS versions; for example, here's the list of meta-symbols `libobjc` uses in order to hide `NSObject` from code targeting earlier versions of macOS:

```
$ld$hide$os10.0$_OBJC_CLASS_$_NSObject
$ld$hide$os10.0$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.0$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.1$_OBJC_CLASS_$_NSObject
$ld$hide$os10.1$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.1$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.2$_OBJC_CLASS_$_NSObject
$ld$hide$os10.2$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.2$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.3$_OBJC_CLASS_$_NSObject
$ld$hide$os10.3$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.3$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.4$_OBJC_CLASS_$_NSObject
$ld$hide$os10.4$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.4$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.5$_OBJC_CLASS_$_NSObject
$ld$hide$os10.5$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.5$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.6$_OBJC_CLASS_$_NSObject
$ld$hide$os10.6$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.6$_OBJC_METACLASS_$_NSObject
$ld$hide$os10.7$_OBJC_CLASS_$_NSObject
$ld$hide$os10.7$_OBJC_IVAR_$_NSObject.isa
$ld$hide$os10.7$_OBJC_METACLASS_$_NSObject
```

It's unlikely that you're going to find this feature any useful for your own code, but knowing how this works may help you decipher those cryptic errors about missing symbols when the symbols are *clearly* there.

## Symbol resolvers

One rather interesting feature of dyld is its support for *symbol resolvers*, which is a way of customizing the process of resolving symbols. You write a symbol resolver, a special function that can implement any custom logic in order to find the address of a symbol, and then dyld executes it at runtime when that symbol is requested.

Using symbol resolvers requires no tricky ld flags, you do it entirely in code. At the assembly level, you can create symbol resolvers using the `.symbol_resolver` [pseudo-op](https://sourceware.org/binutils/docs/as/Pseudo-Ops.html):

```nasm
; two different implementations of foo
_foo1:
	movl 1, %eax
	ret
_foo2:
	movl 2, %eax
	ret

.symbol_resolver _foo
	; check some condition
	call _condition
	jz .ret_foo2
	movq _foo1, %rax
	ret
.ret_foo2:
	movq _foo2, %rax
	ret

; We also need _foo itself to be present in the symbols
; table, but its value does not matter, because it'll be
; replaced with whatever the resolver returns.
.global _foo
_foo:
```

There's no special compiler support at the C level, so you have to use inline assembly to achieve this in C:

```c
static int foo1() {
	return 1;
}

static int foo2() {
	return 2;
}

int foo() {
	// what goes here doesn't matter
	return 0;
}

static void *foo_resolver() {
	__asm__(".symbol_resolver _foo");
	return condition() ? &foo1 : &foo2;
}
```

:::info

The assembly code reads `_foo` instead of just `foo` because on Darwin, there is a name mangling convention for C, which is to prepend each C symbol name with an underscore. In pre-Mach-O-transition Darling, we had to prepend and strip back this underscore when working with ELF files, which was a lot of pain to deal with.

:::

Since the contents of `foo()` don't matter and neither does the name of the resolver (which had no label at all in the assembly listing above), you'd normally combine `foo()` and `foo_resolver()` into one function definition like this:

```c
void *foo() {
	__asm__(".symbol_resolver _foo");
	return condition() ? &foo1 : &foo2;
}
```

One downside of doing this is that it may result in errors about `foo()` prototype being different from what a header file specifies (here, it returns a generic pointer rather than an `int`). Also, note that the magic being done here isn't particularly robust: `dlsym("_foo")` calls will return the original address of `_foo`, the one we just decided to not matter, so in this case it'll be the address of the resolver. It might make more sense to make one of the potential `foo()` implementations act as the `_foo` symbol if you have to care about this case.

One can imagine all sorts of creative ways this feature can be used. Apple themselves use this in `libplatform` to select the most efficient implementation of locking primitives at runtime based on the detected CPU count and features:

```c
#define _OS_VARIANT_RESOLVER(s, v, ...) \
	__attribute__((visibility(OS_STRINGIFY(v)))) extern void* s(void); \
	void* s(void) { \
	__asm__(".symbol_resolver _" OS_STRINGIFY(s)); \
		__VA_ARGS__ \
	}

#define _OS_VARIANT_UPMP_RESOLVER(s, v) \
	_OS_VARIANT_RESOLVER(s, v, \
		uint32_t *_c = (void*)(uintptr_t)_COMM_PAGE_CPU_CAPABILITIES; \
		if (*_c & kUP) { \
			extern void OS_VARIANT(s, up)(void); \
			return &OS_VARIANT(s, up); \
		} else { \
			extern void OS_VARIANT(s, mp)(void); \
			return &OS_VARIANT(s, mp); \
		})
```

These macros generate resolvers that check, at runtime, whether the machine has a single CPU core (as indicated by the `kUP` flag present in the CPU capabilities descriptor on the [commpage](https://docs.darlinghq.org/internals/macos-specifics/commpage.html)), so, for instance, a slightly more efficient spinlock implementation can be used. This check is done only once per symbol when it's loaded, then the symbol is bound directly to the selected implementation and there is zero performance cost per call after that.

In Darling, we additionally use symbol resolvers for an even more ambitious goal: to allow our Mach-O libraries to transparently use Linux ELF libraries installed on the host computer, such as `libX11` or `libcairo`.

The first step to make using ELF libraries work is [`libelfloader`](https://github.com/darlinghq/darling/tree/master/src/libelfloader), our simple ELF loader implementation that has just enough functionality to sucessfully load ld-linux, the Linux counterpart to dyld, and then jump into ld-linux for loading the actual ELF libraries we need. We build `libelfloader` itself as a Mach-O and install it as `/usr/lib/darling/libelfloader.dylib` inside our Darwin chroot directory; this way, it can be directly used from our Darwin code.

One important detail is that `libelfloader` intentionally does *not* merge Mach-O and ELF symbol namespaces. Apart from one pointer (`_elfcalls`) stashed [deep inside](https://github.com/darlinghq/darling/blob/master/src/kernel/emulation/linux/elfcalls_wrapper.c) `libSystem`, all Darwin things remain blissfully unaware there're now several Linux ELF libraries mapped somewhere in the address space. Darwin and Linux "worlds" coexist surprisingly peacefully inside one process&mdash;in particular, each uses its own C library (`libSystem_c` and `glibc`, respectively).

To get access to ELF symbols from the Darwin world, one can use `libelfloader` API incantations like `_elfcalls->dlsym_fatal(_elfcalls->dlopen_fatal("libX11.so"), "XOpenDisplay")`. Next, we have a tool called [wrapgen](https://github.com/darlinghq/darling/blob/master/src/libelfloader/wrapgen/wrapgen.cpp) that makes using ELF symbols easier, way more transparent, and enables us to use third-party code like The Cocotron&mdash;that may expect to call into Linux libraries directly&mdash;without major patches. When given the name of an ELF library (e.g. `libX11.so`), wrapgen retrieves the list of its symbols and automatically generates code like this:

```c
#include <elfcalls.h>
extern struct elf_calls* _elfcalls;

static void* lib_handle;
__attribute__((constructor)) static void initializer() {
	lib_handle = _elfcalls->dlopen_fatal("libX11.so");
}

__attribute__((destructor)) static void destructor() {
	_elfcalls->dlclose_fatal(lib_handle);
}

void* XOpenDisplay() {
	__asm__(".symbol_resolver _XOpenDisplay");
	return _elfcalls->dlsym_fatal(lib_handle, "XOpenDisplay");
}
```

We then build this code as a Mach-O library and install it to `/usr/lib/native/libX11.dylib`; and other Mach-O libraries can just link to it as if it *was* `libX11.so` magically made into a Mach-O. Naturally, we have a CMake function called [`wrap_elf`](https://github.com/darlinghq/darling/blob/master/cmake/wrap_elf.cmake) that makes invoking wrapgen, building the stub Mach-O and installing it to `/usr/lib/native` a breeze: you just call `wrap_elf(X11 libX11.so)`, and then other libraries can link to `libX11` as if it was simply another Mach-O library.

Being able to load and call Linux libraries this easily and transparently feels like having a *superpower*. As I've already mentioned, in the past, Darling used to be a thin compatibility layer, almost directly mapping Darwin library calls onto Linux library calls, but those days are long gone. As of now, Darling is a very conforming Darwin implementation (or rather, Darwin port)&mdash;thanks, in part, to the fact that we're able to directly reuse large portions of Darwin original source code, like `libSystem`, dyld, XNU, and launchd, and in part to our willingness to implement many undocumented details that that code requires, like the commpage mentioned above. And while some very low-level parts of the stack, such as `libsystem_kernel`, have to deal with the reality of actually running on top of the Linux kernel, most of the code only ever "sees" a regular Darwin environment&mdash;Linux or GNU/Linux userland are nowhere to be found. And that is why directly and easily reaching for a native Linux library or connecting to a service running on the Linux host (such as the X server) feels like pulling a rabbit out of a hat, like witnessing a magic trick&mdash;which this `libelfloader`, symbol resolvers and wrapgen trickery, after all, is. But it's a magic trick that only gets more, not less, impressive after you learn how it works.

## Symbol ordering

If for some reason you rely on a specific order your symbols have to end up in a Mach-O file, you can instruct ld to arrange them in precisely that order. (I think relying on that is *insane*, but Apple, of course, thinks different.)

You do this by writing a list of the symbols you require a specific order for, in that order, to a special file called an *order file*, and then passing that file to ld like so:

```bash
$ ld -o libfoo.dylib foo.o -order_file foo.order
```

Unlike the `-reexported_symbols_list` option mentioned above, `-order_file` supports more than just a simple list of names:

<!-- inaccurate language, but close enough (we just want comments to be highlighted in a different color) -->
```bash
symbol1
symbol2
# This is a comment.
#
# You can explicitly specify what object file a symbol belongs
# to, otherwise private (static in C parlance) symbol names can
# get duplicated between object files.
foo.o: _static_function3
# You can also make symbol entries only apply for a specified
# architecture; so you won't need to use separate linking and
# manually apply lipo, as you have to for reexporting symbols.
i386:symbol4
```

It only makes sense to reorder symbols (or, more precisely, blocks of code and data designated by symbols) if nothing relies on being able to "fall through" from the content of one symbol directly to the content of the next. This technique is frequently used by manually written assembly code, but compilers prefer not to rely on it, and to make it clear that the code in a file does not rely on this ability, compilers normally emit a special assembly directive, `.subsections_via_symbols`, which marks the generated Mach-O file as having symbols that can be freely reordered, stripped if unused and so on.

One place Apple themselves rely on symbol reordering is the implementation of toll-free bridging in `libdispatch`. `libdispatch` implements its own object model, "OS object", with a huge amount of macros spread over several source files. This model is to a certain degree compatible with Objective-C object model, so `libdispatch` also implements *toll-free bridging* (not unlike that in Core Foundation), the ability to cast some of `libdispatch` objects directly to Objective-C objects and send them messages as you would to any real Objective-C object. Notably, it is possible to cast `dispatch_data_t` objects directly to `NSData *` and use it with various Cocoa APIs (but not the other way around).

This toll-free bridging is [implemented](https://github.com/darlinghq/darling-libdispatch/blob/master/src/object_internal.h) using an enormous amount of hacks, and some of them require Objective-C class symbols and the corresponding *OS object vtables* to be laid out in a certain order. For instance, there is a [`DISPATCH_OBJECT_TFB`](https://github.com/darlinghq/darling-libdispatch/blob/master/src/object_internal.h#L548-L555) macro which checks whether an Objective-C object originates from a `libdispatch` toll-free bridged class by comparing its `isa` to the vtables of `dispatch_object` and `object`:

```c
#define DISPATCH_OBJECT_TFB(f, o, ...) \
	if (unlikely(((*(uintptr_t *)&((o)._os_obj->os_obj_isa)) & 1) || \
			(Class)((o)._os_obj->os_obj_isa) < \
					(Class)OS_OBJECT_VTABLE(dispatch_object) || \
			(Class)((o)._os_obj->os_obj_isa) >= \
					(Class)OS_OBJECT_VTABLE(object))) { \
		return f((o), ##__VA_ARGS__); \
	}
```

[Here's the order file](https://github.com/darlinghq/darling-libdispatch/blob/master/xcodeconfig/libdispatch.order) they use to force this kind of symbol ordering in `libdispatch`.

## Interposing

The usual way of forcibly replacing an implementation of a function (or contents of any symbol) is to use the `DYLD_INSERT_LIBRARIES` environment variable, which makes dyld load the given Mach-O files into the process and give them higher priority in the symbol name resolution. Of course, this higher priority won't work for binaries that use two-level namespace, so it's most useful in combination with `DYLD_FORCE_FLAT_NAMESPACE`.

Most use-cases of replacing function implementations include the replacement implementation *wrapping* the original implementation. To invoke the original implementation (and not the wrapper itself), the wrapper would normally use a `dlsym()` call with `RTLD_NEXT` flag, like this:

```c
int open(const char* path, int flags, mode_t mode) {
	printf("Called open(%s)\n", path);
	// A "virtual symlink"
	if (strcmp(path, "foo") == 0) {
		path = "bar";
	}
	int (*original_open)(const char *, int, mode_t);
	original_open = dlsym(RTLD_NEXT, "open");
	return original_open(path, flags, mode);
}
```

In addition to this, dyld provides another way to replace symbols, called *dyld interposing*. If any loaded Mach-O contains an `__interpose` section, dyld will treat its contents as pairs of pointers, each pair being a command to replace a symbol implementation.

One the one hand, this method requires no environment variables&mdash;it's enough for any library to contain the `__interpose` section&mdash;which is why it's sometimes referred to as *implicit interposing*. On the other hand, the `__interpose` section explicitly expresses the intent to replace symbol implementations (not just to insert libraries), so dyld can behave smarter about it. In particular, dyld interposing *does* work with a two-level namespace and does not require the original and replacement symbol names to match. On top of that, dyld is smart enough to make the symbol name still refer to the original implementation when used inside the replacement (and all that Mach-O file):

```c
static int my_open(const char* path, int flags, mode_t mode) {
	printf("Called open(%s)\n", path);
	// A "virtual symlink"
	if (strcmp(path, "foo") == 0) {
		path = "bar";
	}
	// This calls the original implementation, despite
	// open() in other places now invoking my_open().
	return open(path, flags, mode);
}

// place a pair of pointers in the __interpose section
__attribute__ ((section ("__DATA,__interpose")))
static struct {
	void *replacement, *replacee;
} replace_pair = { my_open, open };
```

Note that the replacee pointer&mdash;just like any reference to a symbol from a different file&mdash;will actually get stored in the Mach-O as a dummy value with a corresponding entry in the relocation table. The relocation entry references the target symbol name, which is how dyld gets the full, possibly namespaced, name of the symbol to apply interposing to.

Alternatively, there's a private function called `dyld_dynamic_interpose` that allows dynamically interposing symbols at will:

```c
typedef struct {
	void *replacement, *replacee;
} replacement_tuple;

extern const struct mach_header __dso_handle;
extern void dyld_dynamic_interpose(const struct mach_header*, const replacement_tuple replacements[], size_t count);

void interpose() {
	replacement_tuple replace_pair = { my_open, open };
	dyld_dynamic_interpose(&__dso_handle, &replace_pair, 1);
}
```

Of course, any pointers to the replacee that the code saves at runtime, before the symbol gets replaced, will continue pointing to the original symbol.

`DYLD_INSERT_LIBRARIES` and dyld interposing aren't nearly as useful for working with Objective-C code as they are for C, partly because it's hard to directly reference an Objective-C method implementation (`IMP`), partly because Objective-C provides its own means of replacing method implementation, namely, *method swizzling* (and *isa swizzling*).

In Darling, we use interposing as an implementation detail of xtrace, our tool for tracing emulated system calls.

Darwin programs make Darwin system calls (which are of two kinds, BSD syscalls and so-called Mach traps) by calling into `libsystem_kernel`, where the actual userspace side of the syscall ABI is implemented. On Darling, our customized version of `libsystem_kernel` [translates](https://github.com/darlinghq/darling/tree/master/src/kernel/emulation/linux) these Darwin syscalls into regular Linux syscalls and invocations of [Darling-Mach](https://github.com/darlinghq/darling-newlkm), our Linux kernel module that emulates Mach from the kernel side.

strace, a popular tracing tool, can show what syscalls a Linux process makes; using strace with a Darwin executable which is running under Darling produces a trace of the Linux syscalls that our Darwin syscall emulation code makes (as well as Linux syscalls any loaded ELF libraries make directly). While this is very useful, the mapping between Linux syscalls and Darwin syscalls isn't always straightforward, and oftentimes it may be preferable to see what Darwin syscalls the program makes before they go through the emulation layer.

For that, we have our own tracer, [xtrace](https://github.com/darlinghq/darling/tree/master/src/xtrace). Unlike strace, which requires no cooperation from the tracee due to using `ptrace()` API, xtrace needs to hook into the syscall emulation layer inside the tracee process. For that, it [uses](https://github.com/darlinghq/darling/blob/master/src/xtrace/xtrace) `DYLD_INSERT_LIBRARIES=/usr/lib/darling/libxtrace.dylib`, replacing a few trampoline functions inside the syscall emulation layer with ones that log the syscall being made and its result. While xtrace is not as advanced as strace when it comes to formatting arguments and return values, it can display enough of basic info to be useful:

```
Darling [~]$ xtrace arch
<...snip...>
[223] mach_timebase_info_trap (...)
[223] mach_timebase_info_trap () -> KERN_SUCCESS
[223] issetugid (...)
[223] issetugid () -> 0
[223] host_self_trap ()
[223] host_self_trap () -> port right 2563
[223] mach_msg_trap (...)
[223] mach_msg_trap () -> KERN_SUCCESS
[223] _kernelrpc_mach_port_deallocate_trap (task=2563, name=-6)
[223] _kernelrpc_mach_port_deallocate_trap () -> KERN_SUCCESS
[223] ioctl (...)
[223] ioctl () -> 0
[223] fstat64 (...)
[223] fstat64 () -> 0
[223] ioctl (...)
[223] ioctl () -> 0
[223] write_nocancel (...)
i386
[223] write_nocancel () -> 5
[223] exit (...)
```

Here, you can see the process make some BSD and Mach syscalls. While some of them, such as `write()` and `exit()`, are simply mapped to their Linux versions, others require more complex translation. For instance, all the Mach traps are translated to various `ioctls` on the `/dev/mach` device implemented in our kernel module; while the BSD `ioctl()` calls that are made by stdio to determine what kinds of files stdin and stdout refer to (in this case, a tty) [get translated](https://github.com/darlinghq/darling/blob/master/src/kernel/emulation/linux/ioctl/filio.c) into `readlink()`'ing files under `/proc/self/fd/` and then examining the result.

---

I couldn't cover each and every Mach-O feature without risking making this post as long as dyld's own source code. I'll briefly mention a few more here:

  * When writing a plugin for an application to be loaded at runtime, you may need to link the dylib that holds the plugin code against the *executable* of that application. ld allows you to do that using its `-bundle_loader` option.
  * Besides the install name, `LC_LOAD_DYLIB`, `LC_REEXPORT_DYLIB`, and `LC_DYLIB_ID` commands include a pair of numbers, so-called *compatibility* and *current* versions of the library, compatibility version being the earliest version the current version is compatible with. You can set the current and compatibility versions for a dylib you link using ld's `-current_version` and `-compatibility_version` options, respectively. If at runtime dyld discovers that the present copy of a library has a current version that's less then the required compatibility version, it will refuse to load the library.
  * Separately from compatibility and current versions, Mach-O files can also optionally declare a *source version*. This works via a separate command, `LC_SOURCE_VERSION`. The version itself can be set using ld's `-source_version` option, and you can influence whether it gets included into the resulting Mach-O using the `-add_source_version` and `-no_source_version` options.
  * Embedding `Info.plist` contents directly into a section named `__info_plist` allows you to codesign single-executable programs that have no separate `Info.plist` file. This is implemented using an [ad-hoc check](https://github.com/darlinghq/darling-security/blob/master/OSX/libsecurity_codesigning/lib/machorep.cpp#L356-L373) inside Security.framework, which means it's not supported by the usual `CFBundle` / `NSBundle` APIs, so it doesn't allow you to make proper single-executable apps.

Finally, it's worth noting that in addition to all the tricks mentioned above, ld and dyld also contain various hacks to behave slightly differently for "system libraries" and for `libSystem` in particular, activated by testing the library install name against hardcoded prefixes like `/usr/lib/`.
