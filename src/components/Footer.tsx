"use client";

import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Box, Typography, Link, Divider, Container, Stack } from "@mui/material";
import { useState, useEffect } from "react";

interface CustomLink {
    id: string;
    name: string;
    url: string;
}

export default function Footer() {
    const { t } = useTranslation();
    const { branding } = useTheme();
    const year = new Date().getFullYear();
    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);

    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const response = await fetch("/api/custom-links");
                if (response.ok) {
                    const data = await response.json();
                    setCustomLinks(data.links || []);
                }
            } catch (error) {
                console.error("Failed to fetch custom links:", error);
            }
        };

        fetchLinks();
    }, []);

    const hasCustomLinks = customLinks.length > 0;

    return (
        <Box
            component="footer"
            sx={{ mt: 4, borderTop: 1, borderColor: "divider", bgcolor: "background.paper", py: 4 }}
        >
            <Container maxWidth="lg">
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" alignItems="center">
                    {/* Custom Links - displayed on the left if they exist */}
                    {hasCustomLinks && (
                        <Stack direction="row" spacing={2}>
                            {customLinks.map((link) => (
                                <Link
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    color="text.secondary"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </Stack>
                    )}

                    {/* Standard Links */}
                    <Stack direction="row" spacing={2}>
                        {/* GitHub - hidden if custom links exist */}
                        {!hasCustomLinks && (
                            <Link
                                href="https://github.com/TuroYT/snowshare"
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                color="text.secondary"
                                display="flex"
                                alignItems="center"
                            >
                                <Box component="span" sx={{ display: "flex", alignItems: "center", mr: 0.5 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path
                                            fill="currentColor"
                                            d="M12 2C6.48 2 2 6.58 2 12.26c0 4.49 2.87 8.3 6.84 9.64.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.38-2.03 1.01-2.75-.1-.26-.44-1.3.1-2.7 0 0 .83-.27 2.75 1.02A9.36 9.36 0 0 1 12 6.84c.84.004 1.68.11 2.47.32 1.92-1.29 2.75-1.02 2.75-1.02.54 1.4.2 2.44.1 2.7.63.72 1.01 1.63 1.01 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
                                        />
                                    </svg>
                                </Box>
                                {t("footer.github", "GitHub")}
                            </Link>
                        )}

                        {/* License - hidden if custom links exist */}
                        {!hasCustomLinks && (
                            <Link
                                href="https://github.com/TuroYT/snowshare/blob/main/LICENSE"
                                target="_blank"
                                underline="hover"
                                color="text.secondary"
                            >
                                {t("footer.license", "License")}
                            </Link>
                        )}

                        {/* Terms of Use - always visible */}
                        <Link href="/terms-of-use" underline="hover" color="text.secondary">
                            {t("footer.terms_of_use", "Terms of Use")}
                        </Link>
                    </Stack>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary" align="center">
                    © {year} {branding.appName}. {t("footer.rights", "Tous droits réservés.")}
                    <br />
                    Powered by{" "}
                    <Link
                        href="https://github.com/TuroYT/snowshare"
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        color="text.secondary"
                    >
                        SnowShare
                    </Link>
                </Typography>
            </Container>
        </Box>
    );
}
