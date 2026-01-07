import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import { Provider } from "next-auth/providers/index";

import { decrypt } from "./crypto-link";

interface ProviderConfig {
    clientId: string | null;
    clientSecret: string | null;
}

export const providerMap: Record<string, (config: ProviderConfig) => Provider> = {
    github: (config: ProviderConfig) =>
        GithubProvider({
            clientId: config.clientId!,
            clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!)
        }),
    google: (config: ProviderConfig) =>
        GoogleProvider({
            clientId: config.clientId!,
            clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!)
        }),
    discord: (config: ProviderConfig) =>
        DiscordProvider({
            clientId: config.clientId!,
            clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!)
        })
    //LINK - Add new providers here
};

export const availableProviders = [
    {
        id: "github",
        name: "GitHub",
        documentationUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
    },
    { id: "google", name: "Google", documentationUrl: "https://developers.google.com/identity/protocols/oauth2" },
    { id: "discord", name: "Discord", documentationUrl: "https://discord.com/developers/docs/topics/oauth2" }
    //LINK - Add new providers here
];


