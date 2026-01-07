/// <reference types="vite/client" />

// Allow importing TypeScript files as raw text
declare module "*.ts?raw" {
  const content: string;
  export default content;
}
