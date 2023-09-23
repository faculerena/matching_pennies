// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract MatchingPennies {


    mapping(address => uint256) public pendientes;

    struct Jugada {
        address jugador;
        bytes32 jugada;
        bytes32 nonce_hash; 
    }

    struct Revelacion {
        address jugador;
        bool jugada;
        bytes32 jugada_hash;
    }

    Jugada[] public jugada_actual;
    Revelacion[] public revelaciones;

    event log(string message);

    modifier enJuego() {
        require(jugada_actual.length < 2, "Ya hay dos jugadas");
        //chequeo antes de acceder a la lista para no panickear
        require(jugada_actual.length == 1 ? jugada_actual[0].jugador != msg.sender : true, "Estas jugando contra vos mismo mismo, pedile a otro que juegue");
        _;
    }


    modifier algunJugador() {
        require(jugada_actual.length == 2, "No hay dos jugadas");
        require(revelaciones.length < 2, "Ya hay dos revelaciones");        
        require(jugada_actual[0].jugador == msg.sender || jugada_actual[1].jugador == msg.sender, "No sos jugador");
        _;
    }

    function commitJugada(bytes32 input, bytes32 nonce_hash) enJuego public payable  {
        //necesito q pague 1 eth exactamente
        require(msg.value == 1 ether, "No pusiste 1 ether");
        // guardo la jugada
        jugada_actual.push(Jugada(msg.sender, input, nonce_hash));
    }

    function revelarJugada(uint256 nonce, bool input) algunJugador public {
        //recreo el hash

        bytes32 hashed_nonce = keccak256(abi.encodePacked(nonce));
        
        bytes32 hash = keccak256(abi.encodePacked(input, nonce));
        //si no coincide con el de msg.sender me mintió
        //no es un DOS xq tiene longitud 2
        for (uint256 i = 0; i < jugada_actual.length; i++) {
            if (jugada_actual[i].jugador == msg.sender) {
                
                if (jugada_actual[i].jugada != hash) {
                    //pongo la plata en pendientes
                    pendientes[msg.sender] += 0.9 ether;
                    pendientes[jugada_actual[i == 1 ? 0 : 1].jugador] += 1 ether;
                    delete jugada_actual;
                    delete revelaciones;
                    emit log("No coincide el hash");
                    return;
                }

                if (jugada_actual[i].nonce_hash != hashed_nonce) {
                    pendientes[msg.sender] += 0.9 ether;
                    pendientes[jugada_actual[i == 1 ? 0 : 1].jugador] += 1 ether;
                    delete jugada_actual;
                    delete revelaciones;
                    emit log("No coincide el nonce");
                    return;
                }
            }
        }
        //guardo la revelacion
        revelaciones.push(Revelacion(msg.sender, input, hash));
        //si ya revelaron los 2, resuelvo la partida
        if (revelaciones.length == 2) {
            resolverPartida();
        }
    }

    function resolverPartida() private {
        uint256 ganador;
        if (revelaciones[0].jugada == revelaciones[1].jugada) {
            ganador = 0;
        } else {
            ganador = 1;
        }
        //le pago al ganador (o sea, guardo su premio)
        pendientes[jugada_actual[ganador].jugador] += 1.1 ether;
        //reinicio la partida
        delete jugada_actual;
        delete revelaciones;

    }

    function cobrar() external {
        uint256 aPagar = pendientes[msg.sender];
        require(aPagar > 0, "No tenes nada para cobrar");
        pendientes[msg.sender] = 0;
        payable(msg.sender).transfer(aPagar);
    }



    function balance() external view returns (uint256) {
        return address(this).balance;
    }



}
