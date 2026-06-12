/**
 * cat-facts Connector Manifest — U2.5 skill-author generated
 */
import { type ConnectorManifest } from "@/lib/connectors/types";

const manifest: ConnectorManifest = {
  id: "cat-facts",
  name: "Cat-facts",
  version: "1.0.0",
  domain: "engineering",
  description: "Cat Facts API — random feline trivia from catfact.ninja",
  hasMcp: false,
  customClient: true,
  rootPath: "connectors/cat-facts",
};

export default manifest;
