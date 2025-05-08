import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang={String('en')}>
      <Head />
      <body className={String('antialiased')}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}