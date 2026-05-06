input = ENV["SKP_INPUT"]
output = ENV["GLB_OUTPUT"]
log_path = ENV["SKP_EXPORT_LOG"] || File.join(File.dirname(output.to_s), "skp-export.log")

def log_line(path, message)
  File.open(path, "a:utf-8") { |file| file.puts("[#{Time.now}] #{message}") }
end

begin
  raise "SKP_INPUT missing" if input.nil? || input.empty?
  raise "GLB_OUTPUT missing" if output.nil? || output.empty?

  log_line(log_path, "open #{input}")

  UI.start_timer(0.2, false) do
    begin
      Sketchup.open_file(input)

      UI.start_timer(1.0, false) do
        begin
          model = Sketchup.active_model
          log_line(log_path, "active #{model.path}")
          status = model.export(output, { show_summary: false })
          log_line(log_path, "export #{status} #{output}")
        rescue => error
          log_line(log_path, "#{error.class}: #{error.message}")
          log_line(log_path, error.backtrace.join("\n")) if error.backtrace
        ensure
          Sketchup.quit
        end
      end
    rescue => error
      log_line(log_path, "#{error.class}: #{error.message}")
      log_line(log_path, error.backtrace.join("\n")) if error.backtrace
      Sketchup.quit
    end
  end
rescue => error
  log_line(log_path, "#{error.class}: #{error.message}") rescue nil
end
