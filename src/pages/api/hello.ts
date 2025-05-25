// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name?: string;
  message?: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  try {
    res.status(200).json({ name: "John Doe" });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
  }
}