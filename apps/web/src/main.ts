/**
 * NEXUS RELAY — entry point. Self-hosted fonts (no Google Fonts CDN),
 * styles, then the app controller.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./styles.css";
import { App } from "./app";

export const app = new App();
void app.boot();
