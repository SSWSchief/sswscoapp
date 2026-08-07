import {describe,expect,it} from "vitest";import {safeCsvCell,toCsv} from "./csv";
describe("CSV safety",()=>{it("escapes delimiters",()=>expect(toCsv(["A"],[["hello, \"world\""]])).toContain('"hello, ""world"""'));it("neutralizes spreadsheet formulas",()=>expect(safeCsvCell("=CMD() ")).toBe("'=CMD() "));});
