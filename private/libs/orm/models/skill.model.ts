import { IsNotEmpty, Min } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Skill {
	@PrimaryGeneratedColumn()
	ID: number;

	@Column({ unique: true })
	@IsNotEmpty()
	Name: string;

	@Column()
	@Min(1)
	MaxLevel: number;

	@Column()
	@IsNotEmpty()
	Description: string;

	@Column()
	@IsNotEmpty()
	SkillLink: string;

	@Column()
	@IsNotEmpty()
	ImgUrl: string;
}