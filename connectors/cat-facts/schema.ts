/**
 * cat-facts Schema — U2.5 skill-author generated
 */
export interface CatFactsConfig {
  apiUrl: string;
  timeout?: number;
}

export const defaultConfig: CatFactsConfig = {
  apiUrl: process.env.CAT_FACTS_API_URL || "",
  timeout: 10_000,
};
