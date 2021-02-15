const { merge } = require("./sushi-config")
const { coverage } = require("./boring")

module.exports = merge(coverage, {
    skipFiles: ["mocks/", "interfaces/"],
})
