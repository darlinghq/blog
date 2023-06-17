---
title: 'Darling Progress Report Q1 2023'
authors: [facekapow]
tags: [progress]
draft: true
---

It's been a while since our last post (almost 4 years!) but we're finally back with another progress report. The past few years have been an exciting time for Darling with lots of changes happening in the lower levels, numerous bugs getting fixed, and many stubs being added. All these changes have been made with one goal in mind: a better experience for users. We have plans for further improvements, which we hope will make easier to use Darling and improve compatibility.

<!-- truncate -->

## Updated Blog

Our original blog was hosted on Blogger, but by mid-2023, it was looking pretty outdated and had many spam comments. So, as you can see (since you're here), [Ariel][facekapow] remade the blog with [Docusaurus](https://docusaurus.io/). This new engine allows us to write blog posts in Markdown and produces a static site that can be deployed to hosting providers like GitHub Pages. You can find the source for the new blog [here](https://github.com/darlinghq/blog).

The new blog also comes with a new comment system powered by [Giscus](https://giscus.app/) which stores all comments in GitHub Discussions on the main Darling repo. This should make moderation easier and also engage users that see the discussion directly on GitHub in addition to those on the blog website.

Expect more blog posts on the new blog soon. :wink:

## Wiki Converted to Docs

If you knew about Darling back in 2019, you might've seen the wiki in action. It had instructions on how to build Darling, what to try, and some info on the internals of Darling and macOS. Well, in early 2020 (around April), [Luboš][LubosD] converted the wiki into the docs using [mdBook](https://github.com/rust-lang/mdBook). This new system accepts documentation as Markdown and produces a minimal static site specifically tailored for documentation.

Additionally, with the old wiki, only registered users could edit the wiki. With the new docs, because it's in [a repo on GitHub](https://github.com/darlinghq/darling-docs), anyone can contribute to the documentation&mdash;and many have already done so! At the time of writing, 20 users have contributed to the docs and there's been a total of 181 commits on the repo. If you think you can improve the docs in some way (even just a spelling or grammar fix), please feel free to open a pull request and do so!

## New Project Members

2020 saw the introduction of two new members to the Darling team: [Tommy][CuriousTommy] and [Ariel][facekapow].

**TODO**: write more here

## Goodbye, LKM!

The biggest and most notable change with Darling in the past few years took place in 2022: dropping the Linux kernel module. This change allows Darling to run entirely in userspace, which makes for a much more comfortable experience for developers and users of Darling alike. Gone are the days of random kernel panics/freezes due to something misbehaving in Darling.

This change&mdash;developed primarily by [Ariel][facekapow]&mdash;introduced darlingserver, a userspace kernel server for Darling (à la wineserver for Wine). A more detailed post explaining how it works is planned, but essentially it does the same things the LKM did (handling Mach IPC and psynch calls, among others) except it does it all in userspace by setting up a Unix RPC socket that all processes in the container connect to in order to talk to darlingserver. Certain aspects were trickier to implement (signal handling and kernel-side sleeping in particular), but they *were* implemented and darlingserver reached feature parity with the LKM and was merged.

Being free from a kernel module allows Darling to support many more use cases and environments, and we already have some ideas on how to improve that even more (more on that in [The Future](#the-future)).

## Stubs Galore

Over the past few years, many users have contributed lots of stubs. Stubs allow apps to progress further when they don't strictly need the functionality these frameworks provide.

  * [Andrew][ahyattdev] added stubs for many frameworks and libraries, including VideoToolbox, QTKit, AudioUnit, CoreMediaIO, and many more
  * [Tommy][CuriousTommy] added stubs for many frameworks and libraries, including MetalKit, SystemConfiguration, ModelIO, Metal, and many more
  * [Cassiano Vailati][cassvail] added stubs for CoreLocation
  * [Luboš][LubosD] added stubs to AppKit, AudioToolbox, and CoreServices
  * [Ariel][facekapow] added stubs for many frameworks and libraries, including SystemConfiguration, AppleSauce, CoreAnalytics, libsystem_kernel, and many more
  * [Hin-Tak Leung][HinTak] added stubs to ATS, CoreServices, IOSurface, and SystemConfiguration
  * [JCWasmx86][JCWasmx86] added stubs for CloudKit
  * [Zach Wolfe][zachwolfe] added stubs for AssertionServices, libMobileGestalt
  * [Marco Rolappe][mrolappe] added stubs for many frameworks and libraries, including Automator, CalendarStore, Collaboration, CoreAudioKit, and many more
  * [Daníel Grétarsson][dingari] added stubs to CoreAudio, AudioToolbox, ImageIO, and CoreServices

As always, more stub contributions are helpful and always welcome! If you'd like to generate stubs for some new frameworks or libraries, there's [a guide](https://docs.darlinghq.org/contributing/generating-stubs.html) in our docs on how to do so.

:::note

At the time of writing, this guide only works on macOS 10.15 or below. This is because newer versions of macOS rely on a *shared cache* where all system libraries and frameworks are bundled into one binary. We're working on a tool that can generate stubs using the information from the shared cache.

:::

## Apple Open-Source Code Updates

Apple open-sources most of their low-level libraries and components like XNU, libSystem, and even the Security framework&mdash;essentially, they open-source most of the core system (Darwin). Notably, Apple does *not* open-source higher-level libraries and frameworks like AppKit or even Foundation, so we *do* have to reimplement those ourselves, sometimes by building on existing work, like in the case of AppKit (Cocotron) and Foundation (Apportable). However, we can still take advantage of the open-source code and avoid having to reimplement those low-level libraries ourselves. Apple typically publishes new releases of this open-source code some time after a new release of macOS.

Over the last 4 years, Darling has gone through, not one, but *two* updates to nearly all the Apple open-source code we use. The first update was started around mid-2020 by [Ariel][facekapow] and completed in February 2021. This update started because we were having issues building Apple's code on newer versions of Clang and we noticed these problems were fixed in newer versions of Apple's code. This update brought Darling on par with macOS 10.15 in terms of the open-source code used and included with it a few changes in Darling's build system and kqueue implementation.

The second update was started around March 2022 by [Tommy][CuriousTommy] and completed around May 2023. It was started because of Tommy's work on ARM support in Darling; he noticed that Apple's updated code had improved support for ARM (since that code was now being used on Apple Silicon). This update brought Darling on par with macOS 11.5 in terms of the open-source code used (which, again, doesn't include higher-level frameworks like AppKit) and brought with it changes to how Darling's code is organized, as well as changes to the build system and packaging (more on that later).

So where are we now after these updates? Well, our open-source code from Apple (i.e. for low-level libraries) is now on par with macOS 11.5, so the updated functions and APIs from this open-source code are now available in Darling. Additionally, the updated code has much better ARM support, so this should make it easier to add ARM support to Darling in the future. Plus, in the last source update, Tommy added documentation for most of the Apple open-source code on how to update each of them. This should help with future source updates and hopefully make them easier to complete.

## Build System Improvements

As you may or may not know, Darling is a *large* codebase and a large codebase like ours requires a good build system like CMake. Of course, CMake is only half the equation; the other half of the equation is all the scripts, functions, and `CMakeLists.txt` that we write to build our code. Given Darling's current state (where most users have to compile it themselves), having a good, ergonomic build system that allows users to easily build Darling is key. Additionally, our build system should also be easy to develop with, especially to make easier for new contributors.

In these past few years, Darling's build system has seen numerous improvements, both on the user side and the developer side. For instance, [Andrew][ahyattdev] added an option to the build that made it possible for users to build Darling only for certain architectures (e.g. only x86_64). By default, Darling still builds with both 32-bit and 64-bit support, but this option is particularly useful for distros that don't have multilib support (or ones where it's not easy to enable) and thus can't run 32-bit code. Andrew also added support for uninstalling Darling via a script in `tools/uninstall`.

[TheBrokenRail][TheBrokenRail] fixed a number of bugs in the build system and gave the Debian packaging an overhaul (including adding automatic detection of dependencies in elfloader-wrapped libraries); he also added fixes to Darling's CI build on GitHub Actions.

[Sergey][bugaevc] also fixed a few issues with Darling's build system that were causing some of our libraries to be incompatible with their real macOS counterparts; in particular, we weren't building libc++ properly, leading to symbol conflicts. Sergey also updated many more libraries to build properly with the two-level namespace, which allows us to more accurately match macOS's behavior. These changes (along with some other fixes added by Sergey and Ariel) allow more apps to run, such as [ClickHouse DB](https://github.com/ClickHouse/ClickHouse).

### Modular Build

Darling used to be built as one single package with every single library and framework required to be built with it. This also means that all the dependencies for all frameworks and libraries were required to be installed as well. So even if you only wanted to use Darling on the CLI (maybe to use the Xcode CLI tools, for example), you had to install all the dependencies for the GUI components as well.

Fortunately, that all changed in early 2023 when [Ariel][facekapow] modularized the build. You can now choose which components of Darling you'd like to build and install via a CMake configuration option (see [the documentation](https://docs.darlinghq.org/build-instructions.html#building-only-certain-components)), which allows you to avoid installing dependencies for other components and also reduce the size of the installation. Additionally, these changes *also* carry over into the binary packages produced for Darling: you can install individual components via separate Debian or RPM packages. With these updates to how Darling is built and installed, we got to thinking about more ways the install process could be simplified for users and came up with something that would greatly simplify the process for most users&mdash;more on that in [The Future](#the-future).

## vchroot

Back in [our progress report for Q1 2019](../../../../2019/05/03/progress-report-q1-2019/index.md), we mentioned that [Luboš][LubosD] was working on a replacement for the old filesystem virtualization system. This replacement, called vchroot ("virtual chroot"), was completed and merged in February 2020. What does this do for us? Well, it allows us to provide Mach-O code within the container with the same filesystem view it previously had while allowing native ELF code to access the host filesystem as it normally would. That's where the "virtual" part of "virtual chroot" comes from: we perform the equivalent of a chroot for the Darwin code (in libsystem_kernel), but this isn't an actual chroot, so it doesn't affect non-Darwin code.

Importantly, this allows GUI apps to work with absolutely no workarounds! There are no configuration files or sockets that need to be made available in the container. Our code can seamlessly load host libraries (via the method described [here](https://docs.darlinghq.org/internals/calling-host-system-apis.html)) and these host libraries, in turn, can load their own libraries and configuration files and connect to sockets as they normally would.

This filesystem virtualization system also opens up more possibilities: we are now handling path translation between the prefix and the host filesystem ourselves; what if there's more that we could do ourselves? Say, for example, the filesystem overlay (i.e. overlayfs)? We've been thinking about that and have some work in-progress to do so (more on that in [The Future](#the-future)).

## GUI Support Advancements

macOS has some great CLI programs and tools (especially for developers), but of course, the main thing macOS is known for is its collection of great GUI apps. While Darling is still a long way from being able to run many popular apps&mdash;including Logic Pro, Garageband, and Xcode, to name a few&mdash;we *have* made some notable advancements in our GUI support these past few years.

### Initial Metal Support

## Debugging Improvements

As you can imagine, when developing Darling, we often have to trace and debug programs to figure out why they're not working properly. We employ a variety of different methods to do so; in a pinch, even the classic method of "Got here" printing can work. Thankfully, we have access to better debugging tools within Darling, and this is something we've also improved over the last few years.

### xtrace

[xtrace](https://docs.darlinghq.org/contributing/debugging.html#xtrace) (our strace-like tool for debugging Darwin syscalls made into libsystem_kernel) got a major overhaul from [Sergey][bugaevc] in early 2020. Among other things, he enabled xtrace to print syscall arguments (often with their symbolic names), added color to the output, and added [MIG](https://docs.darlinghq.org/internals/macos-specifics/mach-ports.html#mig) routine tracing.

But wait, there's more! Later that year, [Ariel][facekapow] updated xtrace to support multi-threaded programs. A couple years later (in 2022), he updated xtrace again, this time to allow output to be printed to thread-specific logs (avoiding the usual jumbled output produced by multi-threaded programs), and to print more descriptive call-specific details for a number of calls (including `posix_spawn`, `select`, `execve`, and the `kevent` family of calls). Additionally, he also added support for tracing 32-bit programs.

### LLDB

Of course, often the best tool for tracking down bugs is a debugger. Back when we first started using a userspace binary loader (the first time, before the LKM), we had a debugger (based off [modified GDB sources](https://github.com/darlinghq/darling-gdb)). When we transitioned to an in-kernel binary loader with the LKM, however, this Back in 2020, [Luboš][LubosD] 

## Miscellaneous Bug Fixes and Improvements

## The Future

As mentioned earlier, darlingserver makes it easier to both use and develop Darling. However, the bigger motivation was making it easier to *use* Darling. We'd like to continue improving the user experience in Darling wherever possible, which is why we have some work in-progress to completely get rid of privileges/SUID (currently still needed to mount the overlayfs). Furthermore, we're also considering getting rid of the overlayfs altogether, which would allow Darling prefixes to be located on filesystems not supported by overlayfs. This is particularly useful for users with encrypted home directories, since overlayfs does not support storing the upper layer on an encrypted filesystem like eCryptFS. Further in the future, we'd like to make it possible to run Darling within a Flatpak and maybe even allow it to be used as a Flatpak runtime for macOS apps. Getting rid of the kernel module also opens up more possibilities for supporting additional platforms such as Android.

[Tommy][CuriousTommy] is currently working on adding ARM support to Darling. This would allow us to run some newer macOS applications that are only built for ARM (due to Apple's move from Intel processors to Apple Silicon) and maybe even iOS apps in the future. For the time being, the goal is just to get apps running on their respective host platforms (i.e. ARM Darling on ARM hosts, x86 Darling on x86 hosts), but in the future, we'd also like to make it possible to run binaries with different architectures than the host. [Sergey][bugaevc] said it best in issue https://github.com/darlinghq/darling/issues/863#issuecomment-675834045:

> Darling will definitely continue &mdash; at least as a way to run x86_64 (or x86) binaries on x86_64 Linux systems. We also want to get arm64-on-arm64 binaries working (but not there yet).
>
> Then, there's emulation. We're not going to implement a complete emulation solution from scratch, so the potential Darling Rosetta would be based on an existing emulator &mdash; usermode QEMU. We've been envisioning a bright distant future where Darling is able to run binaries for either ppc/ppc64/x86/x64/arm64 on either of those architectures, using Darling Rosetta if the host and the program architecture don't match. But we're probably far away from that. Just arm64 on x64 is fairly possible though, but we have to get native arm64 on arm64 working first.

The modular build changes described earlier have made it more convenient to build and install Darling by choosing the components you want and only building and installing those. We'd like to go a step further: we currently have a CI that builds Debian and RPM packages for each commit; these packages are already split up into different per-component packages. Wouldn't it be great if you could easily install them? That's why there are plans to publish APT and RPM repos for the packages built by the CI, which would allow the vast majority of Darling's users to easily install and update Darling.

## Contributing

We know that Darling is a large codebase that can sometimes be daunting to contribute to, especially for newcomers. We'd like to make it easier for new contributors to improve Darling (even with small fixes or updates), so if you're interested, please let us know what you think would help you personally&mdash;it would probably also help others that would like to contribute! And of course, be sure to check out [our Discord](https://discord.gg/XRD3mQA); we have a `#learning` channel now where we're ready to help you get started with learning Objective-C, Cocoa, Mach, and other macOS internals, as well as contributing to Darling.

<!-- GH user links -->

[ahyattdev]: https://github.com/ahyattdev
[CuriousTommy]: https://github.com/CuriousTommy
[cassvail]: https://github.com/cassvail
[LubosD]: https://github.com/LubosD
[facekapow]: https://github.com/facekapow
[HinTak]: https://github.com/HinTak
[JCWasmx86]: https://github.com/JCWasmx86
[zachwolfe]: https://github.com/zachwolfe
[mrolappe]: https://github.com/mrolappe
[dingari]: https://github.com/dingari
[TheBrokenRail]: https://github.com/TheBrokenRail
[bugaevc]: https://github.com/bugaevc
