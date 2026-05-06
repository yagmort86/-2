require "sketchup.rb"
require "json"
require "net/http"
require "securerandom"
require "tmpdir"
require "uri"

module Chaika
  module SketchUpExporter
    extend self

    PREFS = "ChaikaSketchUpExporter".freeze
    DEFAULT_API_URL = "http://localhost:3001".freeze
    DEFAULT_API_KEY = "chaika-admin-local-secret".freeze

    def settings
      values = UI.inputbox(
        ["API URL", "API key", "Target (main or product id)"],
        [api_url, api_key, target],
        "Chaika Site Exporter"
      )
      return unless values

      Sketchup.write_default(PREFS, "api_url", values[0].to_s.strip)
      Sketchup.write_default(PREFS, "api_key", values[1].to_s.strip)
      Sketchup.write_default(PREFS, "target", values[2].to_s.strip)
    end

    def upload_active_model
      temp_path = File.join(Dir.tmpdir, "chaika-export-#{Time.now.to_i}.glb")

      unless Sketchup.active_model.export(temp_path)
        UI.messagebox("GLB export failed. Use SketchUp version with GLB export support.")
        return
      end

      response = post_model(temp_path)

      if response.code.to_i.between?(200, 299)
        UI.messagebox("Upload complete: #{target_path}")
      else
        UI.messagebox("Upload failed: HTTP #{response.code}\n#{response.body}")
      end
    rescue StandardError => error
      UI.messagebox("Upload failed: #{error.message}")
    ensure
      File.delete(temp_path) if temp_path && File.exist?(temp_path)
    end

    def show_product_ids
      uri = uri_for("/api/sketchup/products")
      response = request(uri, Net::HTTP::Get.new(uri))

      unless response.code.to_i.between?(200, 299)
        UI.messagebox("Product list failed: HTTP #{response.code}\n#{response.body}")
        return
      end

      products = JSON.parse(response.body)
      message = products.map { |product| "#{product["id"]} - #{product["title"]}" }.join("\n")
      UI.messagebox(message.empty? ? "No products found." : message)
    rescue StandardError => error
      UI.messagebox("Product list failed: #{error.message}")
    end

    def post_model(file_path)
      uri = uri_for(target_path)
      http_request = Net::HTTP::Post.new(uri)
      boundary = "----Chaika#{SecureRandom.hex(12)}"
      body = "".b

      body << "--#{boundary}\r\n"
      body << "Content-Disposition: form-data; name=\"model\"; filename=\"#{File.basename(file_path)}\"\r\n"
      body << "Content-Type: model/gltf-binary\r\n\r\n"
      body << File.binread(file_path)
      body << "\r\n--#{boundary}--\r\n"

      http_request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
      http_request["X-Sketchup-Api-Key"] = api_key
      http_request.body = body

      request(uri, http_request)
    end

    def request(uri, http_request)
      http_request["X-Sketchup-Api-Key"] = api_key

      Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(http_request)
      end
    end

    def uri_for(path)
      URI("#{api_url.sub(%r{/\z}, "")}#{path}")
    end

    def target_path
      current_target = target
      return "/api/sketchup/model/upload" if current_target.empty? || current_target == "main"

      "/api/sketchup/products/#{URI.encode_www_form_component(current_target)}/upload"
    end

    def api_url
      Sketchup.read_default(PREFS, "api_url", DEFAULT_API_URL).to_s.strip
    end

    def api_key
      Sketchup.read_default(PREFS, "api_key", DEFAULT_API_KEY).to_s.strip
    end

    def target
      Sketchup.read_default(PREFS, "target", "main").to_s.strip
    end

    unless file_loaded?(__FILE__)
      menu = UI.menu("Extensions").add_submenu("Chaika Site Exporter")
      menu.add_item("Settings") { settings }
      menu.add_item("Show product IDs") { show_product_ids }
      menu.add_item("Upload active model") { upload_active_model }
      file_loaded(__FILE__)
    end
  end
end
