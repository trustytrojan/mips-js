const register_names = [
  'zero', // the constant value 0
  'at', // assembler temporary
  'v0', 'v1', // values for function results and expression evaluation
  'a0', 'a1', 'a2', 'a3', // arguments
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', // temporaries
  's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', // saved temporaries
  't8', 't9', // temporaries
  'k0', 'k1', // reserved for os kernel
  'gp', // global pointer
  'sp', // stack pointer
  'fp', // frame pointer
  'ra', // return address
]

module.exports = {

  /**
   * @param {string|number|bigint} n number to convert to signed 32-bit integer
   */
  i32: (n) => Number(BigInt.asIntN(32, BigInt(n))),

  /**
   * @param {string|number|bigint} n number to convert to unsigned 32-bit integer
   */
  u32: (n) => Number(BigInt.asUintN(32, BigInt(n))),

  resolve_imm(R, arg3) {
    try { return this.i32(arg3) }
    catch(err) { return R[arg3] }
  },

  i32_add(R, rd, rs, arg3) {
    R[rd] = R[rs] + this.resolve_imm(R, arg3)
    this.check_overflow(R[rd])
  },

  u32_add(R, rd, rs, arg3) {
    R[rd] = R[rs] + this.resolve_imm(R, arg3)
  },

  i32_sub(R, rd, rs, arg3) {
    R[rd] = R[rs] - this.resolve_imm(R, arg3)
    this.check_overflow(R[rd])
  },

  u32_sub(R, rd, rs, arg3) {
    R[rd] = R[rs] - this.resolve_imm(R, arg3)
  },

  /**
   * @param {string[]} args array of strings to sanitize
   */
  clean_args(args) {
    for(let i = 0; i < args.length; ++i)
      args[i] = args[i].replace(',', '').replace('$', '').replace(' ', '')
  },

  /**
   * @returns register object with all registers initialized to 0
   */
  create_register_obj() {
    const R = {}
    for(const k of register_names)
      R[k] = 0
    return R
  },

  /**
   * @param {string} s memory instruction to be parsed
   * @returns {[number, string]} string representing register and amount to increment address by
   */
  get_address_increment(s) {
    if(!/[0-9]+\((\$)?[vatsgfr][0-9pat]\)/.test(s)) return
    return [s.substring(1+s.indexOf('('),s.indexOf(')')), this.i32(s.substring(0, s.indexOf('(')))]
  },

  /**
   * @param {string} str string to convert all escaped characters into character encodings
   * @return {string}
   */
  replace_escapes_with_correct_char(str) {
    return str
      .replace('\\n', '\n')
      .replace('\\t', '\t')
  },

  /**
   * @param {string[]} lines 
   */
  trim_whitespace_from_every_line(lines) {
    for(let i = 0; i < lines.length; ++i) {
      lines[i] = lines[i].trim()
    }
  },

  /**
   * @param {string} cause string containing cause of error
   * @return process will be terminated
   */
  error_and_exit(cause, line_no, line) {
    console.log(`ERROR! Cause: ${cause}\nLine ${line_no}:\t${line}`)
    process.exit(1)
  },

  /**
   * @param {number} n
   */
  check_overflow(n) {
    if(n > 2**31 - 1 || n < -(2**31-2)) throw 'Arithmetic overflow'
  },

  /**
   * @param {string[]} arr 
   */
  remove_empty_strings(arr) {
    while(arr.includes(''))
      arr.splice(arr.indexOf(''), 1)
  }
}