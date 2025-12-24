"use client";

import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Box, Typography, Link, Divider, Container, Stack } from "@mui/material";

export default function Footer() {
    const { t } = useTranslation();
    const { branding } = useTheme();
    const year = new Date().getFullYear();

    return (
        <Box component="footer" sx={{ mt: 4, borderTop: 1, borderColor: "divider", bgcolor: "background.paper", py: 4 }}>
            <Container maxWidth="lg">
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                        {t("footer.made_with", "Made with")} <span style={{ color: "#f44336" }}>❤️</span> {t("footer.by", "by Romain")}
                    </Typography>

                    <Stack direction="row" spacing={2}>
                        <Link href="https://github.com/TuroYT/snowshare" target="_blank" rel="noopener noreferrer" underline="hover" color="text.secondary">
                            {t("footer.github", "GitHub")}
                        </Link>
                        <Link href="/LICENSE" underline="hover" color="text.secondary">
                            {t("footer.license", "License")}
                        </Link>
                        <Link href="/terms-of-use" underline="hover" color="text.secondary">
                            {t("footer.terms_of_use", "Terms of Use")}
                        </Link>
                    </Stack>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary" align="center">
                    © {year} {branding.appName}. {t("footer.rights", "Tous droits réservés.")}
                    <br />
                    Powered by <Link href="https://github.com/TuroYT/snowshare" target="_blank" rel="noopener noreferrer" underline="hover" color="text.secondary">SnowShare</Link>
                </Typography>
            </Container>
        </Box>
    );
}
