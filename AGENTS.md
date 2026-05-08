## Doneski

## Documentation for coding agents

* The `README.md` file contains important information for both humans and agents. It is required reading for both.
* Application architecture, file structure, schemas, decisions, and technical information of all kinds is located in `docs/architecture.md`. It is required reading for agents before ANY changes are made. Always update this file as needed for any changes in architecture, layout, or features. (But do not update the file for bug fixes.)

## General rules

* In ambiguous or confusing situations, always pause and ask the user for clarification. It is better to ask for clarification than to guess what the user meant.
* Always prefer simple code over clever code.
* It is sometimes okay to add packaged dependencies if that is the best way to implement a new feature. But ONLY do so with the user's permission. Prefer a bespoke native vanilla Javascript/Python solution to pulling in dependencies, especially for uncomplicated features. For example, we should not pull in the Bootstrap UI library to style a few buttons, but we probably want to pull in a library to parse a well-known file format that lacks built-in support in the programming language.
* New features should generally be accompanied by corresponding test coverage.
* If tests are impacted by code changes, be sure to update the tests.
* Automatically run tests after any functional changes to code or tests.
* Never mock-out tests with `return true` or similar just to make them pass.
* Only make changes to code that is related to the task at hand. For example, don't refactor a function that is not involved in the bug fix or feature request to make it easier to read or more efficient. (But you may certainly suggest fixes or refactoring for something that you ran across incidentally while performing your task.)

## Coding style

* Indentation:
  * Python: Indent using four spaces
  * HTML, CSS, Javascript: Indent using two spaces.
  * Never use tabs for indentation unless the file's format requires them (for example, Makefiles).
* All python classes and functions should have docstrings, except for "special" functions like `__init__` and `__repr__`.
* Most files should have a very brief comment or docstring description (HTML templates are an exception to this.)
* It is best to follow
* Never make changes in code unrelated
