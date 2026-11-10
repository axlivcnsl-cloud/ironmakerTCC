IronMaker - Casa Inteligente Controlada por Interface Web


Descrição do Projeto:

O IronMaker é um projeto de automação residencial desenvolvido como Trabalho de Conclusão de Curso (TCC), com o objetivo de construir uma maquete funcional de uma residência inteligente.

O sistema utiliza Raspberry Pi Pico W para realizar a comunicação com sensores e dispositivos instalados na maquete, enquanto um painel web permite ao usuário monitorar as informações coletadas e controlar determinados dispositivos da residência.

A maquete representa diferentes ambientes de uma casa, como sala, quarto, garagem e jardim, possibilitando a demonstração de recursos de automação residencial de forma prática e visual.


Funcionamento do sistema:

O funcionamento geral da aplicação pode ser representado pelo seguinte fluxo:

Sensores e dispositivos
          ↓
      Arduino
          ↓
    Raspberry Pi
          ↓
     Servidor Web
          ↓
  Site de controle
          ↓
        Usuário
        
Os sensores instalados na maquete coletam informações do ambiente, como temperatura, luminosidade, umidade e presença. Essas informações são processadas pelo sistema, permitindo que determinados dispositivos sejam acionados automaticamente ou controlados manualmente pelo usuário através do painel web.