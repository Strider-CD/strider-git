
test: lint
	@./node_modules/.bin/mocha -R spec

tolint := *.js *.json lib

lint:
	@./node_modules/.bin/eslint --verbose $(tolint)

.PHONY: test lint watch build less
