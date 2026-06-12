/**
 * cat-facts Schema — U2.5 skill-author generated
 */
export interface Cat-factsConfig {
  apiUrl: string;
  timeout?: number;
}

export const defaultConfig: Cat-factsConfig = {
  apiUrl: process.env.CAT_FACTS_API_URL || "",
  timeout: 10_000,
};
