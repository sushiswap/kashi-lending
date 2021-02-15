console.log("Parsing hardhat configuration")

const { hardhat } = require("./boring")
const { merge, get_hardhat_config } = require("./sushi-config")

module.exports = merge(get_hardhat_config(), hardhat)
