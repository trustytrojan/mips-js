.data
  star: .asciiz "*"
  newline: .asciiz "\n"
  prompt: .asciiz "What is n? "
.text

main:
  # store $ra on stack
  sub $sp, $sp, 4
  sw $ra, 0($sp)

  # main body
  jal print_prompt
  jal read_int
  move $a0, $v0
  jal print_triangle

  # restore $ra from stack
  lw $ra, 0($sp)
  addi $sp, $sp, 4

  jr $ra

# self-explanatory
print_prompt:
  li $v0, 4
  la $a0, prompt
  syscall
  jr $ra

# self-explanatory
read_int:
  li $v0, 5
  syscall
  jr $ra

# $a1 = number of stars to print
print_stars:
  li $v0, 4
  la $a0, star
L1:
  syscall
  sub $a1, $a1, 1
  bgt $a1, $zero, L1
L1_exit:
  jr $ra

# self-explanatory
print_newline:
  li $v0, 4
  la $a0, newline
  syscall
  jr $ra

# $a0 = n from the problem
print_triangle:
  # save $ra on stack
  sub $sp, $sp, 4
  sw $ra, 0($sp)

  # main loop body
  move $t0, $a0 # n
L2:
  move $a1, $t0
  jal print_stars
  sub $t0, $t0, 1
  ble $t0, $zero, L2_exit
  move $a1, $t0
  jal print_stars
  jal print_newline
  j L2
L2_exit:

  # restore $ra from stack
  lw $ra, 0($sp)
  addi $sp, $sp, 4

  jr $ra
