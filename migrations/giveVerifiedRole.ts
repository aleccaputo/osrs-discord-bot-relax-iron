import * as dotenv from "dotenv";
import Discord from "discord.js";
import {connect} from "../services/DataService";

dotenv.config();

;(async () => {
    try {
        const serverId = process.env.SERVER;
        const client = new Discord.Client();

        await client.login(process.env.TOKEN);
        await connect();

        const server = await client.guilds.fetch(serverId ?? '')
        if (server) {
            const allMembers = await server.members.fetch();
            for (const member of allMembers.array()) {
                // if they have at least one role, also give them verified
                if (member?.roles.cache.array().filter(x => x.name !== '@everyone').length && process.env.VERIFIED_ROLE_ID) {
                    await member?.roles.add([process.env.VERIFIED_ROLE_ID]);
                }
            }
            process.exit();
        }
        console.error("unable to find server");
        process.exit();
    } catch (e) {
        console.log(e);
    }
})();