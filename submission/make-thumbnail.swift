// Composes the Devpost thumbnail: transparent 1200x800, the squirrel-acorn
// mark large on top, the word Acorn below in Fraunces 800 at cardinal.
// Run: swift submission/make-thumbnail.swift <path-to-fraunces.ttf>
import AppKit
import CoreText

let args = CommandLine.arguments
guard args.count > 1 else { fatalError("pass the Fraunces ttf path") }
let fontURL = URL(fileURLWithPath: args[1])
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let markURL = root.appendingPathComponent("public/acorn-squirrel-mark.png")
let outURL = root.appendingPathComponent("submission/acorn-thumbnail.png")

var registerError: Unmanaged<CFError>?
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &registerError)

guard let cfDescriptors = CTFontManagerCreateFontDescriptorsFromURL(fontURL as CFURL), CFArrayGetCount(cfDescriptors) > 0 else { fatalError("no descriptor in ttf") }
let baseDescriptor = unsafeBitCast(CFArrayGetValueAtIndex(cfDescriptors, 0), to: CTFontDescriptor.self)
// Variable axes: opsz for display, wght 800 to match the wordmark.
let variation: [CFNumber: CFNumber] = [
  0x6F70737A as CFNumber: 144 as CFNumber,
  0x77676874 as CFNumber: 800 as CFNumber
]
let varied = CTFontDescriptorCreateCopyWithAttributes(baseDescriptor, [kCTFontVariationAttribute: variation] as CFDictionary)
let font = CTFontCreateWithFontDescriptor(varied, 210, nil)

guard let mark = NSImage(contentsOf: markURL) else { fatalError("mark missing") }

let width = 1200, height = 800
guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("no context") }
context.clear(CGRect(x: 0, y: 0, width: width, height: height))

// Text metrics first so the mark-plus-word stack centers vertically.
let cardinal = CGColor(srgbRed: 0x8C / 255.0, green: 0x15 / 255.0, blue: 0x15 / 255.0, alpha: 1)
let line = CTLineCreateWithAttributedString(NSAttributedString(string: "Acorn", attributes: [
  .font: font as Any,
  .foregroundColor: NSColor(cgColor: cardinal)!,
  .kern: -2.1
]))
let textBounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)

let markHeight: CGFloat = 470
let markAspect = mark.size.width / mark.size.height
let markWidth = markHeight * markAspect
let gap: CGFloat = 8
let stackHeight = markHeight + gap + textBounds.height
let stackTop = (CGFloat(height) - stackHeight) / 2 + stackHeight

var markRect = CGRect(x: (CGFloat(width) - markWidth) / 2, y: stackTop - markHeight, width: markWidth, height: markHeight)
var imageRect = CGRect(origin: .zero, size: mark.size)
if let cgMark = mark.cgImage(forProposedRect: &imageRect, context: nil, hints: nil) {
  context.interpolationQuality = .high
  context.draw(cgMark, in: markRect)
}

let textX = (CGFloat(width) - textBounds.width) / 2 - textBounds.minX
let textY = stackTop - markHeight - gap - textBounds.height - textBounds.minY
context.textPosition = CGPoint(x: textX, y: textY)
CTLineDraw(line, context)

guard let output = context.makeImage() else { fatalError("no image") }
let rep = NSBitmapImageRep(cgImage: output)
guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("no png") }
try! png.write(to: outURL)
print("wrote \(outURL.path)")
