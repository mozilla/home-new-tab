declare module "*.module.css" {
  const classes: { [key: string]: string }
  export default classes
}

declare module "*.svg?react" {
  import * as React from "react"
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default ReactComponent
}
