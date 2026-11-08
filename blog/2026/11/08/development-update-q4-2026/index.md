---
title: 'Development Update - Q4 2026'
authors: [LubosD]
tags: [progress]
---

It's been a while since our last progress report, and a lot has changed. This update covers the biggest shifts in the project: our new policy on AI-assisted contributions, initial ARM64 support, and what we plan to work on next.

<!-- truncate -->

## Our AI Policy

The biggest change in the project this year is not a feature, but a policy: we have adopted [rules for AI-assisted contributions](https://github.com/darlinghq/darling/blob/master/AGENTS.md). We know this is a divisive topic that many open source projects are debating right now, and the concern about low-quality "slop" is a fair one. But in the hands of people who know the project's internals, an LLM can be a very powerful tool.

Developing Darling has always been a lot of fun, but it was also hard to see the light at the end of the tunnel. Let's face it: Apple is a huge company with many engineers shipping new features all the time, and a small group of volunteers is no match for that capacity. I started Darling in 2012, and until recently very few real-world macOS applications actually ran on it.

Darling has also never had the advantages that Wine enjoys. The surface of macOS applications is much smaller than that of Windows applications, so there is less interest in running them on Linux, and far fewer developers who know the internals of macOS well enough to help. That makes it hard to attract contributors, and just as hard to attract commercial backing of the kind Valve has provided to Wine. The scale of the platform is a problem too. Apple keeps adding frameworks that only ship with macOS: by [one count](https://eclecticlight.co/2026/10/09/how-the-macos-system-has-changed-over-7-years/), macOS 27 contains 464 public and 2,754 private frameworks, up from 273 and 878 in macOS 10.14. Wine can lean on Microsoft's redistributable runtimes, which tools such as winetricks fetch for users, whereas for most of Apple's frameworks there is nothing to download, and we have to implement them ourselves. Matching Apple's engineering capacity looked like an unsolvable problem for a handful of volunteers.

This year, that changed. Several forks appeared that make heavy use of AI, and they achieved impressive results. One of the most visible examples is [a fork that runs League of Legends](https://github.com/lucannez64/darling-lol) (see it [in action on YouTube](https://www.youtube.com/watch?v=ec5pLMSQAWA)). [VibeDarling](https://github.com/VibeDarling) has also gotten several original macOS applications working.

AI changes the equation. What used to be an unsolvable problem with few contributors is now financially realistic, and it lets us compete with Apple on something closer to level ground.

Refusing to use AI would have meant two things for us:

  * We would have become insignificant. Various forks would be moving at extreme speed, while we continued at the same pace with very few things working.
  * The community would likely have fragmented, as people moved to wherever progress is happening.

The policy is how we use this power responsibly. It is written as instructions for AI agents, but it binds the humans using them. Whoever opens a pull request is responsible for every line in it and must be able to explain it in their own words; maintainers' questions get answered by people, not by a bot. The rest of it encodes our clean-room rules: implement the documented contract rather than hacks for a single application, respect the macOS layering, isolate and label undocumented quirks, and never use leaked material or Apple's restricted source such as corecrypto. Nobody should use disassembly to produce matching code. Depending on local laws, it may be acceptable to use disassembly to document how something works and then reimplement it in a clean-room fashion: the agent that writes the code never sees the disassembly, only a separate behavioral description produced in another context.

## ARM64 Support

Darling now has initial ARM64 support. This matters because ARM64 is the current main architecture for Apple hardware. Since Apple's transition to its own silicon, every new Mac has been ARM64-based, and the software being written for macOS today increasingly targets it first, or only. Without ARM64 support, Darling would be limited to an architecture that Apple itself is moving away from.

There is another reason we are confident in this support. The [VibeDarling](https://github.com/VibeDarling) fork is being developed on ARM64, so its day-to-day work exercises the ARM64 code paths constantly. When the fork is folded back into the original Darling, we expect to have good support for this architecture from the start.

## The Future

### The Next Two Months

Our short-term goal is to get the work from all the forks merged back into Darling. For this we are using agent-driven merging logic, which has so far autonomously fixed many bugs, both in the code coming from the forks and in pre-existing bugs in Darling itself.

We plan to officially support three architectures: i386, x86-64 and ARM64 (aarch64). Our confidence in ARM64 comes from the fact that VibeDarling is developed on it.

Separately, I am slowly working on running ARM64 applications on x86-64 hosts by reusing Dynarmic. This is a long shot, so please don't count on it, but I'm curious to see how far it can go.

### Longer Term

I expect to keep receiving a steady flow of patches from other contributors, so I can't speak for them. My own plan is to stabilize AppKit support and make the UI look nice.

I also have a few specific applications I want to get working, either because they are simple enough or because they are open source. Being open source gives the agents a better chance of discovering what the application expects from the system.

I would also like to start adding GUI applications to Darling itself, such as a configuration utility and a log viewer in the spirit of Console.app. Darling should come with native tools for managing it, and they will also serve as real-world tests of our AppKit support.

## Contributing

Darling is a large codebase that can be daunting to contribute to, and we'd like to make it easier. If you want to help, even with a small fix, come talk to us on [our Discord](https://discord.gg/XRD3mQA). If you use an AI assistant, please read our [AI policy](https://github.com/darlinghq/darling/blob/master/AGENTS.md) first: you are responsible for every line you submit, and you should be ready to explain it in your own words.

You can also support the project financially through our [OpenCollective](https://opencollective.com/darlinghq). The funds will be used to cover infrastructure and hosting costs, and perhaps LLM costs.
