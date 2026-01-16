import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import AzureADProvider from "next-auth/providers/azure-ad";
import { OAuthConfig } from "next-auth/providers/oauth";
import { Provider } from "next-auth/providers/index";

import { decrypt } from "./crypto-link";

interface ProviderConfig {
    clientId: string | null;
    clientSecret: string | null;
    issuer?: string | null;
    tenantId?: string | null;
}


const hasSecret = !!process.env.NEXTAUTH_SECRET;

if (!hasSecret) {
    console.warn(
        "NEXTAUTH_SECRET is not set. OAuth provider client secrets cannot be decrypted."
    );
}

export const providerMap: Record<string, (config: ProviderConfig) => Provider> = hasSecret
    ? {
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
                  clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
              }),
          "azure-ad": (config: ProviderConfig) =>
              AzureADProvider({
                  clientId: config.clientId!,
                  clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
                  tenantId: config.tenantId!
              }),
            
          oidc: (config: ProviderConfig) =>
              ({
                  id: "oidc",
                  name: "OpenID Connect",
                  type: "oauth",
                  clientId: config.clientId!,
                  clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
                  wellKnown: `${config.issuer?.replace(/\/$/, "")}/.well-known/openid-configuration`,
                  authorization: { params: { scope: "openid profile email" } },
                  checks: ["pkce", "state"],
                  idToken: true,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  profile(profile: any) {
                      return {
                          id: profile.sub,
                          name: profile.name,
                          email: profile.email,
                          image: profile.picture
                      };
                  }
              } as unknown as OAuthConfig<Record<string, unknown>>),
      }
    : {};

export const availableProviders = [
    {
        id: "github",
        name: "GitHub",
        documentationUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
    },
    {
        id: "google",
        name: "Google",
        documentationUrl: "https://developers.google.com/identity/protocols/oauth2"
    },
    {
        id: "azure-ad",
        name: "Microsoft Entra ID (Azure AD)",
        documentationUrl: "https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc"
    },
    {
        id: "discord",
        name: "Discord",
        documentationUrl: "https://discord.com/developers/docs/topics/oauth2"
    },
    {
        id: "oidc",
        name: "OpenID Connect",
        documentationUrl: "https://openid.net/specs/openid-connect-core-1_0.html"
    },
];
