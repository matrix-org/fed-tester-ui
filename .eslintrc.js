module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "parserOptions": {
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true,
            "jsx": true
        }
    },
    "plugins": [
        "react"
    ],
    "rules": {
        /* Things that should effectively be syntax errors. */
        "indent": [ "error", 2, {
            SwitchCase: 1
        }],
        "linebreak-style": [ "error", "unix" ],
        "semi": [ "error", "always" ],
        /* Things that are always mistakes. */
        "getter-return": [ "error" ],
        "no-compare-neg-zero": [ "error" ],
        "no-dupe-args": [ "error" ],
        "no-dupe-keys": [ "error" ],
        "no-duplicate-case": [ "error" ],
        "no-empty": [ "error" ],
        "no-empty-character-class": [ "error" ],
        "no-ex-assign": [ "error" ],
        "no-extra-semi": [ "error" ],
        "no-func-assign": [ "error" ],
        "no-invalid-regexp": [ "error" ],
        "no-irregular-whitespace": [ "error" ],
        "no-obj-calls": [ "error" ],
        "no-sparse-arrays": [ "error" ],
        "no-undef": [ "error" ],
        "no-unreachable": [ "error" ],
        "no-unsafe-finally": [ "error" ],
        "use-isnan": [ "error" ],
        "valid-typeof": [ "error" ],
        "curly": [ "error" ],
        "no-caller": [ "error" ],
        "no-fallthrough": [ "error" ],
        "no-extra-bind": [ "error" ],
        "no-extra-label": [ "error" ],
        "array-callback-return": [ "error" ],
        "prefer-promise-reject-errors": [ "error" ],
        "no-with": [ "error" ],
        "no-useless-concat": [ "error" ],
        "no-unused-labels": [ "error" ],
        "no-unused-expressions": [ "error" ],
        "no-unused-vars": [ "error" ],
        "no-return-assign": [ "error" ],
        "no-self-assign": [ "error" ],
        "no-new-wrappers": [ "error" ],
        "no-redeclare": [ "error" ],
        "no-loop-func": [ "error" ],
        "no-implicit-globals": [ "error" ],
        "strict": [ "error", "global" ],
        /* Make JSX not cause 'unused variable' errors. */
        "react/jsx-uses-react": ["error"],
        "react/jsx-uses-vars": ["error"],
        /* Development code that should be removed before deployment. */
        // "no-console": [ "warn" ],
        // "no-constant-condition": [ "warn" ],
        // "no-debugger": [ "warn" ],
        // "no-alert": [ "warn" ],
        // "no-warning-comments": ["warn", {
        //     terms: ["fixme"]
        // }],
        /* Common mistakes that can *occasionally* be intentional. */
        "no-template-curly-in-string": ["warn"],
        "no-unsafe-negation": [ "warn" ],
    }
};
