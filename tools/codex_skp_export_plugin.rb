require "fileutils"

root = "D:/Документы/codex проекты/сайт магазин каркасов 2"

ENV["SKP_INPUT"] = File.join(root, "дополнительные материалы", "Альберро 060225 изм.11.skp")
ENV["GLB_OUTPUT"] = File.join(root, "public", "models", "alberro.glb")
ENV["SKP_EXPORT_LOG"] = File.join(root, "public", "models", "skp-export.log")

FileUtils.mkdir_p(File.dirname(ENV["SKP_EXPORT_LOG"]))
File.open(ENV["SKP_EXPORT_LOG"], "a:utf-8") do |file|
  file.puts("[#{Time.now}] codex export plugin loaded")
end

load File.join(root, "tools", "export_skp_to_glb.rb")
