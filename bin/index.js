#!/usr/bin/env node




const papa = require('../index.js')

console.log(__filename)
console.log(process.argv[0])
console.log(process.argv[1])


papa.identify_me()

