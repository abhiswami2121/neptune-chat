/**
 * GitHub Connector — unified entry point.
 */
export { default } from "./manifest";
export {
  searchCodeSchema,
  getFileSchema,
  listPRsSchema,
  createPRSchema,
  spawnCodingAgentSchema,
  githubSchemas,
} from "./schema";
export type {
  SearchCodeInput,
  GetFileInput,
  ListPRsInput,
  CreatePRInput,
  SpawnCodingAgentInput,
} from "./schema";
