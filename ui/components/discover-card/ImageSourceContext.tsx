import { createContext, useContext } from "react"

type ImageSource = "smart-crop" | "original"

export const ImageSourceContext = createContext<ImageSource>("smart-crop")

export function useImageSource() {
  return useContext(ImageSourceContext)
}
