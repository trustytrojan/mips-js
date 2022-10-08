const utils = require('./utils')

/**
 * Allocate static data in memory and map labels to addresses
 * @param {number} i index of `lines` where `.data` was parsed
 * @param {{}} R register object
 * @param {Buffer} M MIPS memory space
 * @param {string[]} lines array of instructions
 * @param {Map} data_labels map of data labels to memory addresses
 */
module.exports = function(i, R, M, lines, data_labels) {
  for(; lines[i] !== '.text'; ++i) {
    if(!lines[i].length) continue
    let str = lines[i].split(' ')
    const label = str.shift()
    const type = str.shift()
    let value = str.join(' ').replaceAll('"', '')
    data_labels.set(label.replace(':', ''), R.gp)
    switch(type) {
      case '.ascii':
        value = utils.replace_escapes_with_correct_char(value)
        R.gp += M.write(value, R.gp)
        break
      case '.asciiz':
        value = utils.replace_escapes_with_correct_char(value)
        R.gp += M.write(value+'\0', R.gp)
        break
      case '.double':
      case '.word':
      case '.half':
      case '.byte':
        value = Number.parseInt(value)
        if(isNaN(value)) error_and_exit(`Static data label "${label}" is not an integer`)
        R.gp += M.writeInt32BE(value, R.gp)
        break
      case '.float':
        value = Number.parseFloat(value)
        if(isNaN(value)) error_and_exit(`Static data label "${label}" is not a floating point number`)
        R.gp += M.writeFloatBE(value, R.gp)
    }
  }
}