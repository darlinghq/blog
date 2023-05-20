---
slug: 2019/05/darling-progress-report-q1-2019.html
title: 'Darling Progress Report Q1 2019'
authors: [ahyattdev]
tags: [lldb, cocotron, git, progress, python, xtrace]
---

Darling made good progress in the first quarter of 2019. A total of 13 issues were closed from January 1, 2019 to March 30, 2019. The work continues for GUI app support. The thing holding us back the most was a lack of support for running a debugger (lldb) in Darling. Last summer, Luboš took care of this complicated task which involved delving into Darling's multithreading and Mach APIs in [#304](https://github.com/darlinghq/darling/issues/304) and was capped off with loading Mach-O binaries in the kernel with [#364](https://github.com/darlinghq/darling/issues/364).

In the meantime, Sergey has been putting a lot of work into getting our new Cocoa stack to work and has produced exciting results. The last thing preventing us from announcing and shipping basic GUI application support is trouble around loading Linux's native OpenGL drivers and other files. Loading native Linux things doesn't reliably work with our current mechanism for filesystem virtualization, which is based on mount namespaces and chrooting.

Luboš is working on a replacement that we have dubbed "vchroot" (virtual chroot) that will be a one-time fix for this issue, but progress has been stalled due to time constraints. We would also like to welcome Jack Howell as the newest member of the project! Below are a few accomplishments which we would like to highlight.

<!-- truncate -->

## Introduction from Jack

We would like to welcome Jack Howell to Darling! Here’s a bit about him:

> I'm excited to see all the recent progress around Darling because I think it might be time for the community to develop a software solution similar to Wine for macOS applications. With so many commercial applications and games being available for macOS,  Darling might have a special place in the ever coming but still not yet fully "mainstream compatible" desktop/workstation Linux experience. My current goal is to help the amazing people behind the Darling project get to a state where Darling is able to run commercial applications that utilize a minimal set of the macOS APIs. (Those are the ones that are theoretically more feasible to run in the short term)
>
> A fair bit of the most popular games right now are in this category. Its no secret I would like to see Linux gaming advance even more and hopefully that future will include Darling at some point.
>
> As for the technical side, I've been looking at the current issues with our Cocotron stack that are blocking a specific game's startup that I'm trying to bring up on Darling. Sergey has been an invaluable source of help during this process. Based on mostly his guidance I sent out an initial set of patches that resolved the issues I did see with the application. I continue testing and troubleshooting to see where the next area is that we will need to tackle.

## Git now works in Darling

Before issue [#356](https://github.com/darlinghq/darling/issues/356) was fixed by Sergey, the popular version-control software Git would crash while executing the index-pack routine. As the routine typically happens while cloning a repository, Git was previously pretty much useless in Darling. With Git now working, software development in Darling has become more of a reality and perhaps even more significant is that this is a step towards getting [Homebrew](https://brew.sh/) working, as it relies on Git extensively. The next step for getting Homebrew to run is HTTPS support for curl, which will require work in `corecrypto`. Some efforts towards getting curl to work have already been completed, including getting `securityd` to run.

## Progress towards Xcode support

Some steps forward were made by Andrew for running Apple's Xcode IDE. While Xcode's GUI will not be working in Darling for the foreseeable future, some issues preventing programs the Xcode Command Line Tools were resolved. The now closed issue [#445](https://github.com/darlinghq/darling/issues/445) documented this effort which resulted in hundreds of missing constants and classes being added to Darling's system frameworks.

While attempting to run xcodebuild, a discrepancy with how Darling determined the bundle path for frameworks (issue [#490](https://github.com/darlinghq/darling/issues/490)) was exposed and promptly fixed.

While the Command Line Tools still don't work when being run through xcodebuild, like before workarounds exist for running them. We are now much closer than before to fully supporting the CLT.

## Multithreading now works in Python 3

Previously Darling failed to support python programs that use the [threading](https://docs.python.org/3/library/threading.html) module. Thanks to Luboš, issue [#462](https://github.com/darlinghq/darling/issues/462) has been fixed.

## xtrace

Sergey has been working on improving xtrace, our Darwin syscall tracing tool. In addition to syscall names, xtrace can now display the arguments passed to syscalls, formatting them appropriately&mdash;as an integer, a pointer or as a string (featuring some basic syntax highlighting). In some cases&mdash;for many Mach traps and for some frequently-used BSD syscalls&mdash;xtrace can even display the arguments *symbolically*, such as displaying a value of `1537` passed to an `open()` call as `O_WRONLY | O_CREAT | O_TRUNC`. In general, xtrace is now mostly on par with, and in some aspects, better than the `dtruss` tool available on macOS.

The coolest new xtrace feature is support for parsing and displaying MIG routine calls. Whenever the traced process sends or receives a Mach message, xtrace prints a short description about the message, such as its destination and reply ports and the size of the message body. With MIG tracing support, xtrace can additionally decode what remote procedure call (RPC) this message actually encodes, and display the call similarly to how it displays syscalls, complete with arguments and return values. This makes it a lot easier to debug issues related to inter-process communication, because Mach IPC and MIG in particular are pervasively used on Darwin for everything from logging to inspecting and debugging other processes.

The xtrace work is not complete yet, but it's close to completion and will be merged in the near future.

## Outlook

With the macOS 10.15 release that will be announced at WWDC this year, 32-bit applications will cease to function. Xcode 10 already lacks support for targeting 32-bit macOS using the SDK included with it. On the other hand, Darling has no plans to remove 32-bit support. The result of this may be an increase in demand for Darling as tech-savvy people try to find ways to run those apps. We wish to accelerate development as much as possible and spark interest in our project leading up to the macOS 10.15 release because this is a big opportunity for growth.

Apple is also rumored to transition towards the ARM architecture for their Macs. While it's hard to see ARM replacing Intel in Desktop Macs, it's possible for macOS to someday abandon the x64_64 architecture as well.

We aim to keep the community updated on the progress of Darling and given our level activity it seems fit to write four progress reports per year. We hope to have lots of good news about our progress when the time for the next progress report comes around!

## Community

It is important that we know what people want to use Darling for in order to properly prioritize the project's development. The usual requests are applications such as Xcode, but some quite interesting uses of Darling in Linux based Continuous Integration (CI) servers which need macOS-only software have popped up recently. If there is something you want to use Darling for which may not be obvious please comment below!
