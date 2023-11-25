import { GuildMember } from 'discord.js';
import { PointsRoles } from '../services/constants/roles';

const allMemberRanks = PointsRoles.map((x) => x.id);

const isModRank = (member?: GuildMember) => member?.roles.cache.some((r) => r.id === process.env.MOD_ROLE_ID) ?? false;

const hasMemberRole = (member?: GuildMember) => member?.roles.cache.some((r) => allMemberRanks.includes(r.id)) ?? false;

export { isModRank, hasMemberRole };
