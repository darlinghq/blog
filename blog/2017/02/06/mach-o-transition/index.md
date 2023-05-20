---
slug: 2017/02/the-mach-o-transition-darling-in-past-5.html
title: 'The Mach-O Transition: Darling in the Past 5 Years'
authors: [LubosD]
tags: [mach-o, history, container, future]
---

Darling has been under development for almost five years now, which invites the questions &mdash; what has happened over the past years, are we getting anywhere and when will we get there.

<!-- truncate -->

## Darling's History

Darling was initially based on the [maloader](https://github.com/shinh/maloader) project, which can still be found on GitHub. Looking back at these times, I regard this largely as a mistake, although I can argue that one learns from his/her mistakes. Back then, I had very little knowledge of macOS technologies and architecture, and maloader was the only existing proof of concept. It is a proof of concept that quickly allows you to get very primitive applications running, but it loses breath even faster as you move to more complex software.

Later on, realizing the limitations of maloader's approach, I embarked on a transition to building Apple's source code directly, instead of doing translation of high level APIs to their Linux counterparts (like maloader), e.g. by directly bridging libSystem to glibc. Although this requires a much larger time investment upfront to get even the very basic "Hello world" application running, it has proven to be the right thing to do. Huge compatibility issues that had plagued Darling since its inception were suddenly gone. And if you build one piece of original Apple source code, it quickly becomes possible to build more with very low effort.

At this point, I looked at Wine as a project of analogous goals and wanted to copy some of their ideas. This turned out to be a mistake as well, although this time it doesn't entail throwing away months' worth of work.

## The Mach-O Transition

As you may know, macOS and other of Apple's operating systems use Mach-O as the format of choice for application and dynamic library binaries. This is in contrast with ELF used on other Unix-like platforms. As of now, the master branch of Darling still produces ELF files. This means ELF is used for all macOS libraries and frameworks, as well as various executables making up the macOS-like environment in Darling.

This is similar to what Wine does. If you peek inside Wine's directories (possibly `/usr/lib/x86_64-linux-gnu/wine/wine` on your system), you will find scores of `.dll.so` files. This take on building up a Windows-like runtime environment has (among other things) enabled the infamous "winelib" based applications to exist. It is very well possible that building ELFs instead of real PE DLLs bears no disadvantages for Wine; I cannot assess this. But it has brought numerous complications for Darling, up to a point where it was decided things had to be done differently.

The biggest hurdle is Apple's reliance on Mach-O specific features. Unlike ELF, which is a very lean format, Apple doesn't think twice before adding hosts of new features in Mach-O. They don't do so in many other areas, as their list of system calls would attest, and Mach-O is no exception. These features have no direct counterparts in ELF &mdash; two-level namespace, symbol reexports, specialized segments, extra initializer parameters or FAT files to name just a few. There are also other, more subtle differences, such as symbol prefixing with an underscore, which is a pain to deal with, as it required Darling to patch every assembly file taken from Apple.

This is why Darling now has a branch named `using-machos-experiment` where all of Darling's components, with the exception of a few small executables required to bootstrap Darling, are built as Mach-O files. Thanks to the Clang compiler, this isn't as hard or daunting as it may seem. Most Linux distributions provide Clang with multitargeting capabilities, meaning it can natively produce Mach-O object files, as if built on macOS itself. The only missing piece was the linker, which was very easy to add and build during Darling's build process.

### What it Means

This change will bring Darling even closer to a real macOS-like environment. There will now be real `.dylib` files in `/usr/lib` when running macOS applications. Applications doing all kinds of exotic non-portable operations (such as loading a standard system `.dylib` file into memory and then asking the dynamic linker to use it) will find themselves at home. In this development branch, all components are built as fat Mach-O files containing both the x86_64 and i386 versions, meaning the build is done in one go.

This puts an end to various symbol name conflicts between macOS libraries and Linux libraries, which appear time from time despite efforts to counter them with ELF symbol versioning. It enables us to use Apple's original dynamic linker or Objective-C runtime, yet another step in reducing the compatibility gap between macOS and Darling. It also improves the chances that an original library coming from macOS would work when placed into Darling, leaving the possible EULA issues aside.

Technically, this has further impact on Darling's ability to interact with the outside world, e.g. with `libasound` or `libpulse` to play a sound, but these complications have *very* simple solutions.

### Further Experiments

The Mach-O branch currently uses a neat trick to run 32-bit macOS applications. It actually loads them in a 64-bit Linux process and it transitions into 32-bit mode (and back) as needed. You may call it a technical exercise with few real-world benefits, and you could probably be right. We will see. But there are certain benefits, such as being able to map commpage at the right address (which would not be possible in a 32-bit Linux process).

## Containerization

Darling still provides prefixes, but no longer manages them the same way as Wine. You probably know the annoying popup saying that Wine is updating the prefix. Well, this is gone in Darling.

Darling now uses overlayfs to overlay user prefixes on top of prefix default contents. Especially in the Mach-O branch, the files are no longer strewn across several places, everything is in `<install-prefix>/libexec/darling`.

After the overlay is set up, Darling switches to this overlay as its root file system (using `pivot_root()`) in its mount namespace. This and other uses of Linux namespaces bring Darling closer to how Docker or LXC work. In future, it could be optionally possible to isolate a Darling prefix into a separate network namespace, making it work more like a standalone system.

## Future Development

Darling is no longer a one man show. Two skilled engineers &mdash; Sergey and Andrew &mdash; have joined in and have already greatly contributed.

Darling currently needs to improve in areas around Mach ports (implemented in a Linux kernel module) and their support in kqueue(). Going forward, the big question is whether to keep pursuing having our own code for Mach port support or try to port over original code from XNU. But after this is tackled, we should be able to run many of macOS daemons including launchd, notifyd, syslogd and others.

In the meantime, Sergey is experimenting with GUI applications, plugging all the needed layers together, and is figuring out how to make progress in this area. Andrew is helping bring Darling's environment closer to macOS, for example by building Perl inside Darling. This could sound stupid, but you would be surprised how often is Perl actually needed (and invoked) on macOS; and no, Darling absolutely cannot use Perl from the underlying Linux system.

While this may not be very interesting for end-users, every project must start with a rock-solid foundation to remain viable in the future. This is why GUI apps are a long-term goal, but you only see Darling being used with console applications. Console applications are not the primary goal, but are the means to an end.

### Documentation and Debugging

Darling is currently severely underdocumented, which makes the initial learning process very difficult for new contributors. I have started a [documentation project](https://wiki.darlinghq.org/documentation:start) on Darling's wiki where I plan to explain both ideas and techniques specific to Darling, as well as general inner workings of macOS. The latter is also very important, because I would bet even most skilled macOS developers have vague knowledge at best of how, for instance, Mach ports work. Even less probably know about the commpage I mentioned earlier in the text.

:::info Time-traveler's Note

The wiki has been converted into the [docs](https://docs.darlinghq.org/).

:::

Work is also underway for the `using-machos-experiment` branch to produce a [gdb-darling](https://github.com/darlinghq/darling-gdb) debugger that would be able to read symbol and debug information not only from ELF files, but also from Mach-Os. This is an absolute must have for the Mach-O Transition, where 99% of Darling's code is compiled into Mach-O files, making debugging otherwise very complicated.
