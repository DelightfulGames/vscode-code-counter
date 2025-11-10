# 🌍 Language Support Documentation

## Code Counter v1.1.0 - 78+ Programming Languages & File Types

VS Code Code Counter provides comprehensive language detection and intelligent comment pattern recognition for **78+ programming languages and configuration file types**. This massive expansion in v1.1.0 represents a 5x increase in language support, making Code Counter one of the most comprehensive code analysis tools available.

---

## 📊 **Coverage Overview**

| Category | Languages | Extensions |
|----------|-----------|------------|
| **Programming Languages** | 52 | 75+ |
| **Configuration & Build** | 15 | 20+ |
| **Development Tools** | 11 | 15+ |
| **Total Coverage** | **78+** | **110+** |

---

## 🔥 **Programming Languages**

### **Web Development** (11 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| JavaScript | `.js` | `//`, `/**/` |
| TypeScript | `.ts` | `//`, `/**/` |
| JSX | `.jsx` | `//`, `/**/` |
| TSX | `.tsx` | `//`, `/**/` |
| HTML | `.html` | `<!---->` |
| CSS | `.css` | `/**/` |
| SCSS | `.scss` | `//`, `/**/` |
| Sass | `.sass` | `//` |
| Less | `.less` | `//`, `/**/` |
| CoffeeScript | `.coffee` | `#`, `###` |
| LiveScript | `.ls` | `#` |

### **Systems Programming** (15 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| C | `.c` | `//`, `/**/` |
| C++ | `.cpp` | `//`, `/**/` |
| C# | `.cs` | `//`, `/**/` |
| Java | `.java` | `//`, `/**/` |
| Go | `.go` | `//`, `/**/` |
| Rust | `.rs` | `//`, `/**/` |
| Swift | `.swift` | `//`, `/**/` |
| Kotlin | `.kt`, `.kts` | `//`, `/**/` |
| Scala | `.scala`, `.sc`, `.sbt` | `//`, `/**/` |
| Dart | `.dart` | `//`, `/**/` |
| Assembly | `.asm`, `.s` | `;` |
| Zig | `.zig` | `//` |
| V | `.v` | `//` |
| Nim | `.nim` | `#` |
| Crystal | `.cr` | `#` |

### **Scripting & Shell** (11 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| Python | `.py` | `#` |
| Ruby | `.rb` | `#` |
| PHP | `.php` | `//`, `#`, `/**/` |
| Shell | `.sh` | `#` |
| Bash | `.bash` | `#` |
| Zsh | `.zsh` | `#` |
| Fish | `.fish` | `#` |
| PowerShell | `.ps1`, `.psm1`, `.psd1` | `#`, `<##>` |
| Batch | `.bat` | `REM`, `::` |
| AWK | `.awk`, `.gawk` | `#` |
| Tcl | `.tcl`, `.tk` | `#` |

### **Functional Programming** (8 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| Haskell | `.hs` | `--`, `{--}` |
| Erlang | `.erl` | `%` |
| Elixir | `.ex`, `.exs` | `#` |
| Clojure | `.clj`, `.cljs` | `;` |
| F# | `.fs`, `.fsx` | `//`, `(**)` |
| OCaml | `.ml`, `.mli` | `(**)` |
| Scheme | `.scm`, `.ss` | `;` |
| Racket | `.rkt` | `;`, `#\||\|#` |

### **Mobile & Platform** (5 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| Swift | `.swift` | `//`, `/**/` |
| Kotlin | `.kt`, `.kts` | `//`, `/**/` |
| Scala | `.scala`, `.sc`, `.sbt` | `//`, `/**/` |
| Dart | `.dart` | `//`, `/**/` |
| Objective-C | `.mm` | `//`, `/**/` |
| Vala | `.vala` | `//`, `/**/` |

### **Data Science & Analytics** (4 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| R | `.r`, `.R` | `#` |
| MATLAB | `.m` | `%`, `%{%}` |
| Julia | `.jl` | `#`, `#={=#` |
| SQL | `.sql` | `--`, `/**/` |

### **Enterprise & Legacy** (7 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| COBOL | `.cbl`, `.cob` | `*` |
| Fortran | `.f`, `.f90`, `.f95` | `!`, `C` |
| Visual Basic | `.vb` | `'` |
| Pascal | `.pas` | `//`, `(**)`  |
| Ada | `.ads`, `.adb` | `--` |
| Groovy | `.groovy` | `//`, `/**/` |
| Delphi | `.dpr`, `.dfm` | `//`, `(**)`  |

### **Specialized Languages** (3 languages)
| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| GraphQL | `.graphql`, `.gql` | `#` |
| Protocol Buffers | `.proto` | `//` |
| ANTLR | `.g4` | `//`, `/**/` |

---

## 🔧 **Configuration & Build Files** (15 types)

### **Build Systems & Project Management**
| Type | Extensions | Comment Syntax |
|------|------------|----------------|
| CMake | `.cmake` | `#` |
| Makefile | `.makefile`, `.mk` | `#` |
| Dockerfile | `.dockerfile` | `#` |
| TOML | `.toml` | `#` |
| YAML | `.yaml`, `.yml` | `#` |
| JSON | `.json` | N/A |
| XML | `.xml` | `<!---->` |

### **Development Tools**
| Type | Extensions | Comment Syntax |
|------|------------|----------------|
| Environment | `.env` | `#` |
| Properties | `.properties` | `#`, `!` |
| GitIgnore | `.gitignore` | `#` |
| EditorConfig | `.editorconfig` | `#`, `;` |
| INI | `.ini` | `;`, `#` |
| Config | `.cfg`, `.conf` | `#`, `;` |

### **Documentation**
| Type | Extensions | Comment Syntax |
|------|------------|----------------|
| Markdown | `.md` | `<!---->` |
| Text | `.txt` | N/A |

---

## 🎯 **Smart Language Detection Features**

### **Comment Pattern Intelligence**
- **Single-line comments**: `//`, `#`, `%`, `--`, `;`, `'`, `!`, `*`
- **Multi-line comments**: `/* */`, `(* *)`, `{- -}`, `%{ %}`, `#={ =#`, `### ###`, `#| |#`, `<# #>`
- **Documentation comments**: Special handling for doc strings and API documentation
- **Language-specific rules**: Custom patterns for unique syntaxes (COBOL columns, Fortran positions, etc.)

### **File Extension Conflict Resolution**
- **MATLAB vs Objective-C**: `.m` files prioritized for MATLAB, `.mm` for Objective-C++
- **Multiple extensions**: Many languages support multiple extensions (e.g., Kotlin: `.kt`, `.kts`)
- **Case sensitivity**: Handles both `.r` and `.R` for R language files
- **Build tools**: Smart detection for Makefile variants and CMake files

### **Accurate Line Counting**
- **Comment detection**: Properly excludes comments from code line counts
- **Blank line handling**: Accurate separation of code, comment, and blank lines
- **Multi-line constructs**: Intelligent handling of multi-line strings and comments
- **Language-specific rules**: Respects each language's unique syntax requirements

---

## 📈 **Version History**

### **v1.1.0 - Massive Language Expansion**
- **Added 50+ new languages** across 5 systematic batches
- **Functional Programming**: Haskell, Erlang, Elixir, Clojure, F#, OCaml, Scheme, Racket
- **Systems & Performance**: Assembly, Rust, Zig, V, Nim, Crystal, COBOL, Fortran
- **Enterprise & Legacy**: Visual Basic, Pascal, Ada, Groovy, Delphi, MATLAB
- **Configuration & Tools**: CMake, Makefile, Dockerfile, TOML, Environment, Properties, etc.

### **v1.0.x - Foundation**
- **Core languages**: JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, etc.
- **Basic configuration**: JSON, YAML, XML, Markdown support
- **Web technologies**: HTML, CSS, SCSS support

---

## 🔍 **Usage Examples**

### **Multi-language Projects**
```
📁 project/
├── frontend/           (TypeScript, SCSS, HTML)
├── backend/            (Go, SQL)  
├── mobile/             (Swift, Kotlin)
├── scripts/            (Python, Shell)
├── config/             (YAML, TOML, Dockerfile)
└── docs/               (Markdown)
```

### **Enterprise Systems**
```
📁 enterprise-app/
├── core/               (Java, Scala)
├── legacy/             (COBOL, Fortran)
├── analytics/          (R, MATLAB, SQL)  
├── infrastructure/     (Bash, PowerShell)
└── build/              (CMake, Makefile)
```

### **Data Science Pipeline**
```
📁 ml-project/
├── analysis/           (R, MATLAB, Julia)
├── processing/         (Python, SQL)
├── visualization/      (JavaScript, TypeScript)
├── deployment/         (Dockerfile, YAML)
└── config/             (TOML, Properties)
```

---

## 🚀 **Future Expansion**

Code Counter continues to expand language support based on community feedback and industry trends. Upcoming considerations include:

- **Emerging languages**: New systems languages and domain-specific languages
- **Framework-specific files**: Enhanced detection for framework configuration files
- **Custom syntax support**: User-defined comment patterns for proprietary languages
- **Advanced analytics**: Language-specific complexity metrics and best practices

---

## 📞 **Contributing Language Support**

Want to see support for a new language? 

1. **Check existing support**: Review this document and the latest release notes
2. **Submit a request**: Create a GitHub issue with language details and sample files
3. **Contribute directly**: Submit a PR with language detection and comment patterns
4. **Provide samples**: Share representative code samples for testing

**Repository**: [DelightfulGames/vscode-code-counter](https://github.com/DelightfulGames/vscode-code-counter)

---

*Last Updated: November 10, 2025 - v1.1.0*