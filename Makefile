.PHONY: build clean test test-mcp test-plugin lint typecheck run-mcp dogfood

build: build-mcp build-plugin

build-mcp:
	cd packages/mcp-server && npm run build

build-plugin:
	cd packages/opencode-plugin && npx tsc

install:
	cd packages/mcp-server && npm install
	cd packages/opencode-plugin && npm install
	npx playwright install chromium 2>/dev/null || true

clean:
	rm -rf packages/mcp-server/dist
	rm -rf packages/opencode-plugin/dist
	rm -rf ~/.opencode-pilot/screenshots/*.png

test: test-mcp test-plugin

test-mcp:
	node --experimental-specifier-resolution=node --test packages/mcp-server/tests/*.test.ts

test-plugin:
	node --experimental-specifier-resolution=node --test packages/opencode-plugin/tests/*.test.ts

typecheck:
	cd packages/mcp-server && npx tsc --noEmit
	cd packages/opencode-plugin && npx tsc --noEmit

lint:
	npx biome check packages/ 2>/dev/null || echo "biome not configured yet"

run-mcp:
	cd packages/mcp-server && node dist/index.js

dogfood:
	@echo "Running Pilot self-test..."
	opencode run "/pilot navigate to https://example.com and take a screenshot named 'dogfood-test'" --print-logs
