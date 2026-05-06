require "sketchup.rb"
require "extensions.rb"

loader = File.join(__dir__, "chaika_exporter", "main")
extension = SketchupExtension.new("Chaika Site Exporter", loader)
extension.description = "Export active SketchUp model to the Chaika site as GLB."
extension.version = "0.1.0"
extension.creator = "Chaika"

Sketchup.register_extension(extension, true)
