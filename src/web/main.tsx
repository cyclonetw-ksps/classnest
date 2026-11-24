import { render } from "preact";
import { App } from "./App";
import { installFieldValidation } from "./forms";
import "./styles.css";

installFieldValidation();
render(<App />, document.getElementById("app")!);
