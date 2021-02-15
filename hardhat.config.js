console.log("Parsing hardhat configuration")

const { hardhat } = require("./boring")
const { merge, hardhat_config } = require("./sushi-config")

module.exports = merge(hardhat_config, hardhat)