import { Baloo_2, Baloo_Da_2, Nunito } from "next/font/google";

export const nunito = Nunito({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-nunito" });
export const baloo = Baloo_2({ subsets: ["latin", "devanagari"], weight: ["500", "700", "800"], variable: "--font-baloo" });
export const balooDa = Baloo_Da_2({ subsets: ["bengali"], weight: ["500", "700"], variable: "--font-baloo-da" });
