import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A one-time sign-in code. Only a keyed hash is stored, never the code. */
@Entity('login_codes')
export class LoginCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  codeHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
