/* Ambient declarations so `tsc` accepts Vite's CSS imports. */
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";
