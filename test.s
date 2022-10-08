.data
  newline: .asciiz "\n"
  tab: .asciiz "\t"

.text

main:
  move $s0, $ra

  li $a0, 123
  jal print_int
  li $a0, 999
  jal print_int

  move $ra, $s0
  jr $ra

# $a0 should be the desired integer to print
print_int:
  li $v0, 1
  syscall
  li $v0, 4
  la $a0, newline
  syscall
  jr $ra

# $a0 should be the starting address to print characters from
print_string:
  li $v0, 4
  syscall
  la $a0, newline
  syscall
  jr $ra

read_int:
  li $v0, 5
  syscall
  jr $ra