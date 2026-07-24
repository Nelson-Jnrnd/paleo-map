/* Ambient declarations so `tsc` accepts Vite's CSS imports. */
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";

/* Vite resolves an imported image asset to its served URL string. */
declare module "*.png" {
  const src: string;
  export default src;
}
