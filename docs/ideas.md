# From Spec to Production via Agentic Harness

## Want to build an agentic code build harness

Use local to build and GitHub Actions to check and merge the code.
Have a loop to run through iterations of Spec -> Plan -> Build -> Test -> Review -> Simplify -> Ship
Use Agent Hooks
Use multiple LLMs , e.g., Claude builds, GitHub copilot provides the review, Gemini judges the review. 
Keep each change to a small, reviewable increment. 
Capture metrics on each loop.
The priority is quality, speed, then cost.
The idea is that we can iterate on this harness with quick increments as we measure the outcomes, try new hypotheses, try new experiments, and discover better ways to build code.
Build verification first before writing code.
Ensure that the build agent can't change the tests. It can write to memory and a separate test agent can update the tests.
Use and enforce TDD. 
Use mutation testing.
Set up a process to run a security review. Produce a report that Security team can review.
Set up a penetration test process, running burp suite, nmap, and API fuzz tester.
Add behavioural guardrails, like hooks. Add acceptance gates, like a spec ready bar. Add handoff and escalation rules. 
Never edit CI or workflow, branch and release config or secrets
Human in the loop - want to move from in the loop, to on the loop, to out of the loop.
Success metrics
* loop iterations to green
* cycle time
* human touch count
* escaped defects

Before the loop starts the most important is a solid spec and solid test pyramid. So these have to be judged and if not at the required level then improve before it can start.
There are lots of competing skills so may have to be swapped out to evaluate different ones.
Add architectural conformance in to the inner loop. Put as much as possible into the inner loop. Security checks, sonarqube like checks, architectural checks, simplicity checks, etc.
Keep an audit trail.
Use git worktrees and Claude Advisors and Claude workflows.
Don't read PDFs, it takes too many tokens, ask for them to be converted to Markdown first, even though this will miss some details.

## References
* [Addy Osmani Agent Skills](https://github.com/addyosmani/agent-skills)
* [OpenSpec](https://github.com/Fission-AI/openspec)
* [Maintaining Code Quality at Agent Speed: 7 Patterns for Agentic Engineering](https://engineering.salesforce.com/maintaining-code-quality-at-agent-speed-7-patterns-for-agentic-engineering/)
* [Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
* [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)
* [Agent Harness Engineering](https://addyosmani.com/blog/agent-harness-engineering/)
* [How to write a good spec for AI agents](https://addyosmani.com/blog/good-spec/)
* [Andrej Karpathy 4 rules for CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills)
* [the new SDLC with vibe coding](https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding)

