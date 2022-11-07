const utils = require('./utils')
const { u32, i32 } = utils
const { stdout, exit } = process
const { input } = require('./input')

module.exports = class MIPS {

  // declare private field
  #instructions

  /**
   * @param {{}} _
   * @param {{}} R 
   * @param {Buffer} M 
   * @param {Map} labels 
   * @param {Map} data_labels 
   */
  constructor(_, R, M, labels, data_labels) {
    /**
     * @param {string} arg register name or data label to get address from
     * @returns {number} desired memory address
     */
    function addr_get(arg) {
      if(data_labels.has(arg))
        return data_labels.get(arg)
      else {
        const [ rs, SignExtImm ] = utils.get_address_increment(arg)
        return R[rs]+SignExtImm
      }
    }
    function set_hi_lo(product) {
      _.hi = (product >> 32)
      _.lo = ((product << 32) >> 32)
    }
    this.#instructions = {
      async syscall() {
        switch(R.v0) {
          case 1: stdout.write(R.a0.toString()); break
          case 2:
          case 3: stdout.write(R.f12.toString()); break
          case 4: while(M[R.a0]) stdout.write(String.fromCharCode(M[R.a0++])); break
          case 5: R.v0 = Number.parseInt(await input()); break
          case 6: 
          case 7: R.v0 = Number.parseFloat(await input()); break
          case 8:
            const str = await input()
            for(let i = 0; i < R.a1; ++i)
              M[R.a0+i] = str[i]
            break
          case 9:
            if(R.a0 > 0) { R.v0 = R.gp; R.gp += R.a0 }
            else if(R.a0 < 0) { R.gp += R.a0; R.v0 = R.gp }
            break
          case 10: exit(0)
        }
      },
      la([ rd, label ]) {
        R[rd] = data_labels.get(label)
        if(R[rd] === undefined) throw 'la: Undefined label'
      },
      jal([ label ]) {
        R.ra = _.pc+1
        _.pc = labels.get(label)
        if(_.pc === undefined) throw 'jal: Undefined label'
      },
      j([ label ]) {
        _.pc = labels.get(label)
        if(_.pc === undefined) throw 'j: Undefined label'
      },
      jr([ rs ]) {
        if(R[rs] < _.text) throw `jr: Bad address: ${R[rs]}`
        _.pc = R[rs]-1
      },
      sll([ rd, rs, shamt ]) { R[rd] = R[rs] << u32(shamt) },
      srl([ rd, rs, shamt ]) { R[rd] = R[rs] >>> u32(shamt) },
      slt([ rd, rs, rt ]) { R[rd] = (R[rs] < R[rt]) ? 1 : 0 },
      slti([ rd, rs, imm ]) { R[rd] = (R[rs] < i32(imm)) ? 1 : 0 },
      sltu([ rd, rs, rt ]) { R[rd] = (R[rs] < R[rt]) ? 1 : 0 },
      sltiu([ rd, rs, imm ]) { R[rd] = (R[rs] < u32(imm)) ? 1 : 0 },
      blt([ rs, rt, label ]) { if(R[rs] < R[rt]) _.pc = labels.get(label) },
      bgt([ rs, rt, label ]) { if(R[rs] > R[rt]) _.pc = labels.get(label) },
      ble([ rs, rt, label ]) { if(R[rs] <= R[rt]) _.pc = labels.get(label) },
      bge([ rs, rt, label ]) { if(R[rs] >= R[rt]) _.pc = labels.get(label) },
      beq([ rs, rt, label ]) { if(R[rs] === R[rt]) _.pc = labels.get(label) },
      bne([ rs, rt, label ]) { if(R[rs] !== R[rt]) _.pc = labels.get(label) },
      lbu([ rt, arg2 ]) { R[rt] = M.readUInt8(addr_get(arg2)) },
      lhu([ rt, arg2 ]) { R[rt] = M.readUInt16BE(addr_get(arg2)) },
      lui([ rt, imm ]) { R[rt] = i32(imm) << 16n },
      lw([ rt, arg2 ]) { R[rt] = M.readInt32BE(addr_get(arg2)) },
      sb([ rt, arg2 ]) { M[addr_get(arg2)] = R[rt] },
      sh([ rt, arg2 ]) { M.writeInt16BE(R[rt], addr_get(arg2)) },
      sw([ rt, arg2 ]) { M.writeInt32BE(R[rt], addr_get(arg2)) },
      add([ rd, rs, rt ]) { utils.i32_add(R, rd, rs, rt) },
      addi([ rd, rs, imm ]) { utils.i32_add(R, rd, rs, imm) },
      addu([ rd, rs, rt ]) { utils.u32_add(R, rd, rs, rt) },
      addiu([ rd, rs, imm ]) { utils.u32_add(R, rd, rs, imm) },
      sub([ rd, rs, arg3 ]) { utils.i32_sub(R, rd, rs, arg3) },
      subu([ rd, rs, arg3 ]) { utils.u32_sub(R, rd, rs, arg3) },
      mult([ rd, rs ]) { set_hi_lo( R[rd] * R[rs] ) },
      multu([ rd, rs ]) { set_hi_lo( R[rd] * R[rs] ) },
      mflo([ rd ]) { R[rd] = _.lo },
      mfhi([ rd ]) { R[rd] = _.hi },
      nor([ rd, rs, rt ]) { R[rd] = ~(R[rs] | R[rt]) },
      or([ rd, rs, rt ]) { R[rd] = R[rs] | R[rt] },
      ori([ rd, rs, imm ]) { R[rd] = R[rs] | u32(imm) },
      and([ rd, rs, rt ]) { R[rd] = R[rs] & R[rt] },
      andi([ rd, rs, imm ]) { R[rd] = R[rs] & u32(imm) },
      li([ rd, imm ]) { R[rd] = Number.parseInt(imm) },
      move([ rd, rs ]) { R[rd] = R[rs] }
    }
  }

  /**
   * @param {string} line 
   */
  async parse_and_run(line) {
    const args = line.split(' ')
    const op = args.shift()
    utils.clean_args(args)
    const instr = this.#instructions[op]
    if(!instr) throw `Unknown instruction`
    await instr(args)
  }

}
