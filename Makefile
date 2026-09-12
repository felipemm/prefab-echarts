# Prefab renderer fork — ECharts-backed chart layer.
#
# This repository is a fork of PrefectHQ/prefab that replaces the renderer's
# Recharts-backed chart layer with an ECharts-backed one. It is maintained as a
# small, re-appliable delta: the patch branch is rebased onto each upstream
# release tag rather than merged forward.
#
# Upgrading is therefore not a merge. Use `make upgrade VERSION=x.y.z`, which
# rebases the patch branch, records the pinned version, and runs the full check.
#
#   make            # this help
#   make check      # the gate: tests + both renderer artifacts
#   make upgrade VERSION=0.20.3
#
# See CHANGES.md for the upstream delta.

SHELL      := bash
.SHELLFLAGS := -eu -o pipefail -c

RENDERER       := renderer
UPSTREAM       := upstream
PATCH_BRANCH   := echarts
VERSION_FILE   := PREFAB_VERSION

BUNDLED_BUILD  := $(RENDERER)/dist/bundled/index.html
BUNDLED_TARGET := src/prefab_ui/renderer/app.html

NPM := cd $(RENDERER) && npm

.DEFAULT_GOAL := help

# ---------------------------------------------------------------- help

.PHONY: help
help: ## Show this help
	@echo "Prefab renderer fork — ECharts chart layer"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Pinned upstream version: $$(cat $(VERSION_FILE) 2>/dev/null || echo '(unset)')"

# ---------------------------------------------------------------- setup

.PHONY: install
install: ## Install dependencies (npm ci for the renderer, uv sync for Python)
	$(NPM) ci --no-audit --no-fund
	uv sync

# ---------------------------------------------------------------- verify

.PHONY: test
test: ## Run the renderer test suite, including the upstream contract tests
	$(NPM) test

.PHONY: test-py
test-py: ## Run the Python-side wire contract tests
	uv run --frozen --quiet pytest tests/test_contract.py -q

.PHONY: schema-check
schema-check: ## Fail if the wire fixtures drift from the Python models
	uv run --quiet tools/generate_schemas.py --check

.PHONY: generate-schemas
generate-schemas: ## Regenerate the wire fixtures + manifest from the Python models
	uv run --quiet tools/generate_schemas.py

.PHONY: check
check: test test-py schema-check build ## The gate: renderer + Python tests, schema freshness, both artifacts

.PHONY: lockstep
lockstep: ## Verify the pinned version matches an installed prefab-ui: make lockstep PREFAB_UI=0.20.2
	@echo "pinned in this fork : $$(cat $(VERSION_FILE) 2>/dev/null || echo '(unset)')"
	@if [ -n "$(PREFAB_UI)" ]; then \
		if [ "$$(cat $(VERSION_FILE))" = "$(PREFAB_UI)" ]; then \
			echo "installed prefab-ui  : $(PREFAB_UI)"; echo "✓ in lockstep"; \
		else \
			echo "installed prefab-ui  : $(PREFAB_UI)"; \
			echo "✗ MISMATCH — the renderer and prefab-ui must be the same version"; exit 1; \
		fi; \
	else \
		echo "(pass PREFAB_UI=<version> to compare against an installed prefab-ui)"; \
	fi

# ---------------------------------------------------------------- build

.PHONY: build-cdn
build-cdn: ## Build the code-split CDN renderer (renderer/dist/app)
	$(NPM) run build:cdn

.PHONY: build-bundled
build-bundled: ## Build the single-file renderer (renderer/dist/bundled/index.html)
	cd $(RENDERER) && npx vite build --config vite.config.bundled.ts

.PHONY: sync-bundled
sync-bundled: build-bundled ## Overwrite src/prefab_ui/renderer/app.html (dirties a tracked upstream file)
	@echo "NOTE: this overwrites a tracked upstream file and adds ~7 MB to the delta."
	@echo "      It is NOT part of the normal workflow — the fork ships the CDN build and"
	@echo "      consumers point PREFAB_RENDERER_URL at it. Do not commit the result unless"
	@echo "      you have decided to ship the bundled renderer too."
	cp $(BUNDLED_BUILD) $(BUNDLED_TARGET)
	@echo "synced $(BUNDLED_BUILD) -> $(BUNDLED_TARGET) ($$(stat -f%z $(BUNDLED_TARGET) 2>/dev/null || stat -c%s $(BUNDLED_TARGET)) bytes)"

.PHONY: build
build: build-cdn build-bundled ## Build both renderer artifacts (into renderer/dist, gitignored)

# ---------------------------------------------------------------- upgrade

.PHONY: upgrade
upgrade: ## Rebase onto an upstream release tag: make upgrade VERSION=0.20.3
	@if [ -z "$(VERSION)" ]; then \
		echo "usage: make upgrade VERSION=<x.y.z>   (the upstream release tag, without the leading v)"; \
		exit 2; \
	fi
	@if ! git diff-index --quiet HEAD --; then \
		echo "working tree is dirty — commit or stash before upgrading"; exit 1; \
	fi
	@echo "==> fetching upstream tags"
	git fetch $(UPSTREAM) --tags --prune
	@git rev-parse -q --verify "refs/tags/v$(VERSION)" >/dev/null \
		|| { echo "upstream tag v$(VERSION) not found in $(UPSTREAM)"; exit 1; }
	@echo "==> rebasing $(PATCH_BRANCH) onto v$(VERSION)"
	@if ! git rebase "refs/tags/v$(VERSION)" $(PATCH_BRANCH); then \
		echo; \
		echo "rebase stopped (conflicts). Resolve them, then run:"; \
		echo "  git rebase --continue && make upgrade-check VERSION=$(VERSION)"; \
		exit 1; \
	fi
	@echo "==> recording pin"
	@echo "$(VERSION)" > $(VERSION_FILE)
	@echo "==> verifying"
	$(MAKE) install
	$(MAKE) check
	@echo
	@echo "✓ $(PATCH_BRANCH) is now on upstream v$(VERSION)"
	@echo
	@echo "Next, in the consuming project:"
	@echo "  - bump prefab-ui to ==$(VERSION)   (lockstep: the wire format is the contract)"
	@echo "  - bump the renderer reference to this commit"
	@echo "Then publish this fork:  git push --force-with-lease origin $(PATCH_BRANCH)"

.PHONY: upgrade-check
upgrade-check: ## Finish an interrupted upgrade after resolving conflicts
	@echo "==> recording pin"
	@echo "$(VERSION)" > $(VERSION_FILE)
	$(MAKE) install
	$(MAKE) check

.PHONY: push
push: ## Push the patch branch to the fork (force-with-lease; never to upstream)
	@test "$$(git branch --show-current)" = "$(PATCH_BRANCH)" \
		|| { echo "check out $(PATCH_BRANCH) first"; exit 1; }
	git push --force-with-lease origin $(PATCH_BRANCH)

# ---------------------------------------------------------------- info

.PHONY: status
status: ## Show the pinned version, the delta against it, and worktree state
	@echo "patch branch    : $(PATCH_BRANCH)"
	@echo "pinned version  : $$(cat $(VERSION_FILE) 2>/dev/null || echo '(unset)')"
	@if git rev-parse -q --verify "refs/tags/v$$(cat $(VERSION_FILE) 2>/dev/null)" >/dev/null 2>&1; then \
		echo "patch commits   : $$(git rev-list --count "refs/tags/v$$(cat $(VERSION_FILE))..$(PATCH_BRANCH)")"; \
	fi
	@echo "upstream head   : $$(git rev-parse --short $(UPSTREAM)/main 2>/dev/null || echo '(not fetched)')"
	@echo
	@echo "worktree:"
	@git status --short || true
	@echo
	@git log --oneline -3

.PHONY: diff
diff: ## Show the full delta against upstream at the pinned version
	@git diff "refs/tags/v$$(cat $(VERSION_FILE))..$(PATCH_BRANCH)" --stat

.PHONY: clean
clean: ## Remove build output
	rm -rf $(RENDERER)/dist
