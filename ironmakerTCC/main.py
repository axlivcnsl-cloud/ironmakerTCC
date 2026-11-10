# IronMaker - Raspberry Pi Pico W
import network  # type: ignore[import-not-found]  # MicroPython-only module
import socket
import time
import dht  # type: ignore[import-not-found]  # MicroPython-only module
import gc
import json
from machine import Pin, ADC  # type: ignore[import-not-found]  # MicroPython-only module

# ------------------------------------------
# CONFIGURAÇÃO WI-FI
# ------------------------------------------
from secrets import SSID, SENHA  # type: ignore[attr-defined]

# ------------------------------------------
# PINOS
# ------------------------------------------
led_sala = Pin(9, Pin.OUT)
led_garagem = Pin(11, Pin.OUT)
led_quarto = Pin(12, Pin.OUT)
led_jardim = Pin(13, Pin.OUT)

motor = Pin(10, Pin.OUT)

sensor_pir = Pin(14, Pin.IN, Pin.PULL_DOWN)
dht_sensor = dht.DHT11(Pin(8))
ldr_adc = ADC(2)

# ------------------------------------------
# CONFIGURAÇÕES DE AUTOMAÇÃO
# ------------------------------------------
modo_quarto = "auto"
modo_jardim = "auto"
modo_ventilador = "auto"

TEMPO_APAGAR_QUARTO = 10000  # 10 segundos
TEMPERATURA_LIGA = 27
TEMPERATURA_DESLIGA = 28

# Mantidos os limites do LDR que já estavam no código original.
# Se a montagem do divisor resistivo estiver invertida, será necessário
# inverter as comparações após observar os valores reais no monitoramento.
LIMITE_LIGA_JARDIM = 12000    # Acende quando o valor subir (escurecer)
LIMITE_DESLIGA_JARDIM = 15000

# ------------------------------------------
# ESTADOS
# ------------------------------------------
led_sala.off()
led_garagem.off()
led_quarto.off()
led_jardim.off()
motor.off()

temperatura = None
umidade = None
valor_ldr_raw = None
porcentagem_luz = None

temperatura_valida = False
umidade_valida = False
ldr_valido = False
pir_valido = True
presenca_detectada = False

agora_inicio = time.ticks_ms()
ultimo_movimento = agora_inicio
ultima_leitura_dht = time.ticks_add(agora_inicio, -3000)
ultima_leitura_ldr = time.ticks_add(agora_inicio, -1000)

# ------------------------------------------
# CONEXÃO WI-FI
# ------------------------------------------
wifi = network.WLAN(network.STA_IF)
wifi.active(True)

print("Conectando ao Wi-Fi...")
wifi.connect(SSID, SENHA)

tempo_inicio_wifi = time.ticks_ms()
while not wifi.isconnected():
    if time.ticks_diff(time.ticks_ms(), tempo_inicio_wifi) > 30000:
        print("Não foi possível conectar ao Wi-Fi em 30 segundos.")
        print("Confira SSID e senha e reinicie o Pico W.")
        raise RuntimeError("Falha na conexão Wi-Fi")
    time.sleep(1)

ip = wifi.ifconfig()[0]
print("Wi-Fi conectado! IP:", ip)
print("API IronMaker: http://{}:80".format(ip))

# ------------------------------------------
# LEITURAS DOS SENSORES
# ------------------------------------------
def ler_dht():
    global temperatura, umidade
    global temperatura_valida, umidade_valida

    try:
        dht_sensor.measure()
        temperatura = dht_sensor.temperature()
        umidade = dht_sensor.humidity()
        temperatura_valida = True
        umidade_valida = True
    except Exception as erro:
        temperatura = None
        umidade = None
        temperatura_valida = False
        umidade_valida = False
        print("Erro ao ler DHT11:", erro)


def ler_ldr():
    global valor_ldr_raw, porcentagem_luz, ldr_valido

    try:
        soma = 0
        for _ in range(10):
            soma += ldr_adc.read_u16()
            time.sleep_ms(2)

        valor_ldr_raw = soma // 10
        porcentagem_luz = int((valor_ldr_raw * 100) / 65535)
        ldr_valido = True
    except Exception as erro:
        valor_ldr_raw = None
        porcentagem_luz = None
        ldr_valido = False
        print("Erro ao ler LDR:", erro)


def atualizar_pir():
    global presenca_detectada, ultimo_movimento, pir_valido

    try:
        presenca_detectada = bool(sensor_pir.value())
        pir_valido = True
        agora = time.ticks_ms()

        if modo_quarto == "auto":
            if presenca_detectada:
                ultimo_movimento = agora
                led_quarto.on()
            elif time.ticks_diff(agora, ultimo_movimento) >= TEMPO_APAGAR_QUARTO:
                led_quarto.off()
    except Exception as erro:
        pir_valido = False
        print("Erro ao ler PIR:", erro)


def aplicar_automacao_jardim():
    if modo_jardim != "auto" or not ldr_valido or valor_ldr_raw is None:
        return

    if valor_ldr_raw < LIMITE_LIGA_JARDIM:
        led_jardim.on()
    elif valor_ldr_raw > LIMITE_DESLIGA_JARDIM:
        led_jardim.off()
    # Na faixa intermediária, mantém o estado anterior (histerese).


def aplicar_automacao_ventilador():
    if modo_ventilador != "auto" or not temperatura_valida or temperatura is None:
        return

    if temperatura > TEMPERATURA_LIGA:
        motor.on()
    elif temperatura < TEMPERATURA_DESLIGA:
        motor.off()
    # Entre 30°C e 31°C, mantém o estado anterior.


def atualizar_sensores():
    global ultima_leitura_dht, ultima_leitura_ldr

    agora = time.ticks_ms()

    # O DHT11 precisa de intervalo entre leituras.
    if time.ticks_diff(agora, ultima_leitura_dht) >= 2500:
        ler_dht()
        ultima_leitura_dht = agora
        aplicar_automacao_ventilador()

    # LDR atualizado em intervalo menor.
    if time.ticks_diff(agora, ultima_leitura_ldr) >= 500:
        ler_ldr()
        ultima_leitura_ldr = agora
        aplicar_automacao_jardim()

    # PIR é verificado em todas as passagens do loop principal.
    atualizar_pir()


# ------------------------------------------
# RESPOSTAS HTTP E CORS
# ------------------------------------------
def responder(cliente, corpo="", tipo="text/plain", status="200 OK"):
    corpo_bytes = corpo.encode("utf-8")
    cabecalho = (
        "HTTP/1.1 " + status + "\r\n"
        "Content-Type: " + tipo + "; charset=utf-8\r\n"
        "Content-Length: " + str(len(corpo_bytes)) + "\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "Access-Control-Max-Age: 600\r\n"
        "Cache-Control: no-store\r\n"
        "Connection: close\r\n"
        "\r\n"
    )
    cliente.sendall(cabecalho.encode("utf-8") + corpo_bytes)


def status_json():
    dados = {
        "online": True,
        "pico_ip": ip,

        "sala": "LIGADA" if led_sala.value() else "DESLIGADA",
        "garagem": "LIGADA" if led_garagem.value() else "DESLIGADA",
        "quarto": "LIGADA" if led_quarto.value() else "DESLIGADA",
        "jardim": "LIGADA" if led_jardim.value() else "DESLIGADA",
        "ventilador": "LIGADO" if motor.value() else "DESLIGADO",

        "modo_quarto": modo_quarto,
        "modo_jardim": modo_jardim,
        "modo_ventilador": modo_ventilador,

        "temp": temperatura,
        "umi": umidade,
        "temperatura_valida": temperatura_valida,
        "umidade_valida": umidade_valida,

        "luz": porcentagem_luz,
        "ldr_raw": valor_ldr_raw,
        "ldr_valido": ldr_valido,

        "presenca": "DETECTADO" if presenca_detectada else "SEM MOVIMENTO",
        "presenca_detectada": presenca_detectada,
        "pir_valido": pir_valido
    }
    return json.dumps(dados)


# ------------------------------------------
# COMANDOS HTTP
# ------------------------------------------
def executar_rota(rota):
    global modo_quarto, modo_jardim, modo_ventilador, ultimo_movimento

    # Sala - somente manual
    if rota == "/sala/on":
        led_sala.on()
        return "200 OK", "OK"
    if rota == "/sala/off":
        led_sala.off()
        return "200 OK", "OK"

    # Garagem - somente iluminação manual
    if rota == "/garagem/on":
        led_garagem.on()
        return "200 OK", "OK"
    if rota == "/garagem/off":
        led_garagem.off()
        return "200 OK", "OK"

    # Quarto - os comandos on/off selecionam o modo manual.
    if rota == "/quarto/on":
        modo_quarto = "manual"
        led_quarto.on()
        return "200 OK", "OK"
    if rota == "/quarto/off":
        modo_quarto = "manual"
        led_quarto.off()
        return "200 OK", "OK"

    # Jardim - os comandos on/off selecionam o modo manual.
    if rota == "/jardim/on":
        modo_jardim = "manual"
        led_jardim.on()
        return "200 OK", "OK"
    if rota == "/jardim/off":
        modo_jardim = "manual"
        led_jardim.off()
        return "200 OK", "OK"

    # Ventilador - os comandos on/off selecionam o modo manual.
    if rota == "/ventilador/on":
        modo_ventilador = "manual"
        motor.on()
        return "200 OK", "OK"
    if rota == "/ventilador/off":
        modo_ventilador = "manual"
        motor.off()
        return "200 OK", "OK"

    # Modos individuais
    if rota == "/modo/quarto/auto":
        modo_quarto = "auto"
        ultimo_movimento = time.ticks_ms()
        atualizar_pir()
        return "200 OK", "OK"
    if rota == "/modo/quarto/manual":
        modo_quarto = "manual"
        return "200 OK", "OK"

    if rota == "/modo/jardim/auto":
        modo_jardim = "auto"
        ler_ldr()
        aplicar_automacao_jardim()
        return "200 OK", "OK"
    if rota == "/modo/jardim/manual":
        modo_jardim = "manual"
        return "200 OK", "OK"

    if rota == "/modo/ventilador/auto":
        modo_ventilador = "auto"
        ler_dht()
        aplicar_automacao_ventilador()
        return "200 OK", "OK"
    if rota == "/modo/ventilador/manual":
        modo_ventilador = "manual"
        return "200 OK", "OK"

    if rota == "/":
        return "200 OK", "API IronMaker ativa. Consulte /status"

    return "404 Not Found", "Rota não encontrada"


# ------------------------------------------
# SERVIDOR HTTP
# ------------------------------------------
endereco = socket.getaddrinfo("0.0.0.0", 80)[0][-1]
servidor = socket.socket()
servidor.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
servidor.bind(endereco)
servidor.listen(2)
servidor.settimeout(0.05)

print("Servidor HTTP iniciado em http://{}:80".format(ip))

while True:
    atualizar_sensores()

    cliente = None
    try:
        cliente, endereco_cliente = servidor.accept()
        cliente.settimeout(1.0)

        pedido = cliente.recv(1024)
        if not pedido:
            continue

        try:
            pedido_texto = pedido.decode("utf-8")
        except Exception:
            responder(cliente, "Requisição inválida", status="400 Bad Request")
            continue

        linha = pedido_texto.split("\r\n", 1)[0]
        partes = linha.split()

        metodo = partes[0] if len(partes) >= 1 else ""
        rota = partes[1] if len(partes) >= 2 else "/"
        rota = rota.split("?", 1)[0]

        if metodo == "OPTIONS":
            responder(cliente, "", status="204 No Content")
        elif metodo != "GET":
            responder(cliente, "Método não permitido", status="405 Method Not Allowed")
        elif rota == "/status":
            responder(cliente, status_json(), "application/json")
        else:
            status_http, mensagem = executar_rota(rota)
            responder(cliente, mensagem, status=status_http)

    except OSError:
        # Timeout do accept() é esperado para manter as leituras dos sensores ativas.
        pass
    except Exception as erro:
        print("Erro na requisição:", erro)
        if cliente is not None:
            try:
                responder(cliente, "Erro interno", status="500 Internal Server Error")
            except Exception:
                pass
    finally:
        if cliente is not None:
            try:
                cliente.close()
            except Exception:
                pass
        gc.collect()

