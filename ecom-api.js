var initLoading = true;
var actualPage = '';
var ParmSubCategory = '0';
var ParmCategory = '0';
var ParmProduct = '';
var ParmSearch = '';
var ParmPage = 1;
var ParmComboId = '';
var listaaUsar = '';
var tipoDeOrden;
var time_cache = 3 * 60 * 60 * 1000; //3horas
var apiUrl = 'response.php';
var categorias = [];
var marcas = [];
var subCategorias = {};
//var montosVentas = [];
var actualProduct = null;
var actualSubCategory = null;
var cantidadDeProductos = 0;
var productPagination = 20;
var productsInCart = [];
var subTotalPrecio1 = 0;
var actualSubtotal = 0;
var actualDescuentos = 0;
var actualTotal = 0;
var cartProducts = [];
var cantidadConCargo = 0;
var acumulado = 0;
var isChangedShippingAdress = false;
var iserrorTelefono = false;
var typingTimer;
var doneTypingInterval = 1000;
var $searchInput = $('#searchInput');

$(document).ready(function () {
    loadViewProduct();

    var path = window.location.pathname;
    actualPage = path.split("/").pop();

    ParmSubCategory = getUrlParameter('subcat');
    ParmCategory = getUrlParameter('cat');
    ParmProduct = getUrlParameter('producto_id');
    ParmSearch = encodeURI(getUrlParameter('buscar'));
    ParmComboId = getUrlParameter('combo_id');
    ParmPage = getUrlParameter('page');

    actualSubtotal = 0;
    actualDescuentos = 0;
    actualTotal = 0;

    if (initLoading) {
        showLoading();
    }

    getCategorias();
    getCart();

    var subcatget = new URLSearchParams(window.location.search).get("subcat");

    if (subcatget != undefined && subcatget != "") {
        let showNL = getCookie('showNL');
        if (showNL == null) {
            setTimeout(() => {
                showNewsletterPopup();
            }, 20000);
        }
    }

    //cerrar header si se hace click en cualquier lado
    $("#maincontainer, #buttons_b, footer").click(function (e) {
        setTimeout(() => {
            if (!clickToAddCart) {
                close_header_cart();
            }
        }, 200);
    });

    $('#registro_tipo_usuario').on('change', function () {
        if ($(this).val() >= '2') {
            $('#registro_dni_label').html('CUIT');
        } else {
            $('#registro_dni_label').html('DNI');
        }
    });

    if (mobilecheck()) {
        var screenClientH = document.documentElement.clientHeight - 280;
        $('#header_response_items_container').css('height', screenClientH);
        //popupadd mobile
        ShowAddModalMobile();
    } else {
        $('#header_response_items_container').addClass('desktop');
        //popupadd desktop
        ShowAddModalDesktop()
    }

    $('body').on('click', function (event) {
        if ($(event.target).closest("#panelnews").length != 1) {
            $("#panel_newsletter").hide();
            setCookie('showNL', 'OK');
        }
    });
});

function showlogin() {
    $('#panel_login').addClass("active");
}

function showregister() {
    $('#panel_login').removeClass("active");
    $('#panel_register').addClass("active");

    //init map for shipping address
    var shipping_data = { direccion_envio_lat: 0, direccion_envio_lng: 0 };
    checkoutShippingAddress(shipping_data, 'reg_shipping_address_input', 'reg_shipping_address_map', false);
}

function getCategorias_post(data_, dataM_) {
    $.each(data_, function (key, val) {
        categorias.push(val);
        $('#response_header_categorias').append('<li><a href="#sm_headerCat_' + val.categoriaID + '" class="hasmenu"><span class="ico alimentos" style="background:url(' + val.imagenMenu + ') center center / contain no-repeat;"></span><span class="title">' + val.categoria + '</span></a></li>');
        $('#response_home_categories').append('<div class="c col-sm-6 col-md-3"><a href="categorias?cat=' + val.categoriaID + '"><div class="" style="background:url(' + val.imagen + ') center center / cover no-repeat;"><span href="categorias?cat=' + val.categoriaID + '"></span></div></a></div>');
    });

    $('#response_header_categorias').append('<li><a href="productos?subcat=2005" class="hasmenu"><span class="ico alimentos" style="background:url(https:////distrisuronline.com//CatalogoEcom//Categorias//categorias_descuentos_i.jpg) center center / contain no-repeat;"></span><span class="title">Ofertas</span></a></li>');

    $.each(dataM_, function (key, val) {
        marcas.push(val);
    });

    getSubCategorias();
}

function getCategorias() {
    var CategoriasSession = sessionStorage.getItem('categorias');
    var MarcasSession = sessionStorage.getItem('marcas');
    var ti = Date.now() - getCookie('categorias_time');

    if (CategoriasSession != null && MarcasSession != null && ti < time_cache) {
		getCategorias_post(JSON.parse(CategoriasSession), JSON.parse(MarcasSession));
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getCategorias' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
			getCategorias_post(JSON.parse(data['data']['categorias']), JSON.parse(data['data']['marcas']));
			
			sessionStorage.setItem('categorias', data['data']['categorias']);
            sessionStorage.setItem('marcas', data['data']['marcas']);

            setCookie('categorias_time', Date.now());

            return false;
        }).fail(function (data) {
            //console.log("Err: " + data);
            return false;
        });
    }
}

function getSubCategorias() {
    var SubCategoriasSession = sessionStorage.getItem('subCategorias');
    var ti = Date.now() - getCookie('subCategorias_time');

    if (SubCategoriasSession != null && ti < time_cache) {
		var data_ = JSON.parse(SubCategoriasSession);
        getSubCategorias_post(data_);
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getSubCategorias' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
			var data_ = JSON.parse(data['data']);
            getSubCategorias_post(data_);
            
			sessionStorage.setItem('subCategorias', data['data']);
            setCookie('subCategorias_time', Date.now());

            return false;
        }).fail(function (data) {
            //console.log("Err: " + data);

            return false;
        });
    }
}

function getSubCategorias_post(data_) {
    $.each(data_, function (key, val) {
        if (subCategorias[val.categoriasID[0]] == undefined) {
            subCategorias[val.categoriasID[0]] = [];
        }
        subCategorias[val.categoriasID[0]].push(val);
    });

    var subCatsHeader = '';
    $.each(subCategorias, function (key, val) {
        subCatsHeader += '<ul id="sm_headerCat_' + key + '">';
        $.each(val, function (ksc, vsc) {
            subCatsHeader += '<li><a href="productos?subcat=' + vsc.subCategoriasEcomItemID + '">' + vsc.subCategoria + '</a></li>';
        });
        subCatsHeader += '</ul>';
    })

    $('#response_header_subCategorias').html(subCatsHeader);
    eventMenuHeader();
    sidebarCategorias();

    if (actualPage == 'categorias') {
        listSubcategories();
        getProductosDestacados();
        createBreadcrums('categorias');
    } else if (actualPage == 'index' || actualPage == '') {
        showViewProduct();
        showMostViewProduct();
        getHomeBanners();
        showImbatibles();

        showLoading(false);
    } else if (actualPage == 'productos') {
        createBreadcrums('productos');

        if (actualSubCategory != null) {
            if (actualSubCategory.ageGate) {
                checkAgeGate();
            }
        }

        if (ParmSubCategory == 2005) {
            listProducts('getOfertas');
        } else {
            listProducts('getProducts');
            getProductosDestacados();
        }
    } else if (actualPage == 'producto') {
        getProductInfo();
    } else if (actualPage == 'lista_deseados') {
        listProducts('getWishList');
    } else if (actualPage == 'busqueda') {
        listProducts('getSearch');
    } else if (actualPage == 'ofertas') {
        listProducts('getOfertas');
    } else if (actualPage == 'combos') {
        getCombos();
    } else if (actualPage == 'combo_productos') {
        $('#comboOptions').hide();
        getComboData();
        getComboCart();
    } else if (actualPage == 'combo_productos2') {
        $('#comboOptions').show();
        $('#comboSideCart').show();
        $('#combo_list_products').show();
        $('#product_list_free').show();
        $('#product_list_buy').show();
        getComboCart();
        getComboProductos();
    } else {
        showLoading(false);
    }
}

function findMarca(marcaID) {
    let Vres = marcas.find(x => x.marcadID == marcaID);
    if (Vres) {
        return Vres.marca;
    } else {
        return '';
    }
}

function getProductInfo(p) {
    $.ajax({
        url: apiUrl,
        data: { action: 'getProductInfo', product_id: p },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        var dataM_ = JSON.parse(data['data']);

        actualProduct = dataM_['lsProductos'][0];
        var cantEnCart = data['cant_enCart'];
        var actMarc = findMarca(actualProduct.marcaId);
        var cantUnidades = cantEnCart * actualProduct.uxBReal;
        var cantenCartHtml = '';

        var precioSinDescHtml = "";

        if (!cantEnCart) { cantEnCart = 0; }

        var textoDescuento = "";
        var htmlPrecioSinIva='';
        
        if (data.userType == 3) {
            listaaUsar = actualProduct.precioActual4;
            precioReal = listaaUsar;
            precioxunidad = (listaaUsar / actualProduct.uxBReal).toFixed(2);
             htmlPrecioSinIva= 'Precio sin IVA $'+ (listaaUsar/1.21).toFixed(2);
        } else {
            precioxunidad = (actualProduct.precioActual2 / actualProduct.uxBReal).toFixed(2);
            listaaUsar = actualProduct.precioActual1;
            precioReal = actualProduct.precioActual2;
            precioSinDescHtml = '<span style="font-size: 2em;">Lista </span>\
            <span class="preciotachado" style="font-size: 2em;" >$ '+ listaaUsar + '</span><br>';
        }

        var textoSinStock = "";
        let productInfoHtml = "";
        var productBotonera = "";
        $('#detallexbulto').html('');
        $('#detallexbulto').hide();
        var botonBorrar = '<a href="javascript:;" onclick="updateCartItemAmount(' + actualProduct.productosID + ', 0, $(this))" class="delete_all" ></a>';

        if (actualProduct.stockDisponible < 1) {
            textoSinStock = '<div class="alert alert-danger">POR EL MOMENTO SIN STOCK</div>';
        }

        var htmlPrecioporunidad = "";
        //var htmlPrecioSinIva= 'Precio sin IVA $'+ Math.round(listaaUsar/1.21,2);
        
        if (actualProduct.precioAnterior1 != "" && data.userType != 3) {
            var porcentajedescuento = Math.round((((Number(precioReal)) / listaaUsar) - 1) * -100, 0);

            textoDescuento = '<span class="iconOFF">&nbsp;&nbsp;-' + porcentajedescuento + '% &nbsp;</span>';

            if (porcentajedescuento < 1) {
                precioSinDescHtml = ' <span class=""> &nbsp;&nbsp; </span>';
                textoDescuento = '';
            }
          
            descuentoBox = '<div><span class="percent">$' + actualProduct.precioActual2 + ' con descuento </span></div>';
        }

        cantenCartHtml = ' <i class="fa badge fa-2x" value=' + cantEnCart + '>&#xf07a;</i><i>$ ' + cantEnCart * listaaUsar + ' </i>';

        if (actualProduct.uxBReal > 1) {
            htmlPrecioporunidad = '<div class="nopercent"><span >Precio por unidad $' + (precioReal / actualProduct.uxBReal).toFixed(2) + '</span> ' + textoDescuento + '</div>';
        }

        productInfoHtml = '<div class="header_mobile">\
            <h2>'+ actualProduct.descripcion + '</h2>\
            <div class="marca"><span id="m1">'+ actMarc + '</span> | Cod.Prod: ' + actualProduct.sku + '</div>\
            </div>\
            <div class="thumb">\
            <span class="thumb_img" style="background:url('+ actualProduct.imagen + ') center center / cover no-repeat"></span>\
            </div>\
            <div class="details">\
            <h2>'+ actualProduct.descripcion + '</h2>\
            <div class="marca"><span id="m2">'+ actMarc + '</span> | Cod.Prod: ' + actualProduct.sku + '</div>\
            '+ precioSinDescHtml + '\
            <div class="nopercent"><span > $'+ precioReal + '</span> ' + textoDescuento + '</div>\
              </div>'+ htmlPrecioporunidad +'<br>'+htmlPrecioSinIva+ ' <br><br> <div id="cantenCartHtml"></div>';

        if (textoSinStock == "") {
            productBotonera = '<div class="incrementer-class-name">\
                <a class="css-button">\
                <span class="css-button-icon"><i class="fa fa-minus" aria-hidden="true" onclick="addProductToCart('+ actualProduct.productosID + ', ' + -1 + ')"></i></span>\
                </a>\
                <input type="number" class="md-input" id="inputProducto" name="count" onchange="updateCartItemAmount('+ actualProduct.productosID + ', this.value, $(this),' + actualProduct.uxBReal + ')"   min="0" value="' + cantUnidades + '" onClick="this.select();"  />\
                <a class="css-button">\
                <span class="css-button-icon"><i class="fa fa-plus" aria-hidden="true" onclick="addProductToCart('+ actualProduct.productosID + ',' + 1 + ')"></i></span>\
                </a>\
                '+ botonBorrar + '</DIV>';
        } else {
            productBotonera = textoSinStock;
        }

        $('#productInfoHtml').html(productInfoHtml);
        $('#productBotonera').html(productBotonera);
        $('#cantenCartHtml').html(cantenCartHtml);
        $('#inputProducto').val(cantUnidades);
        if (data.inwishlist) {
            $('#wishlist').addClass('active');
        }

        $('#wishlist').show();
        $("#wishlist").click(function (e) {
            e.preventDefault();
            addToWishList();
        });

        ParmSubCategory = dataM_['lsProductos'][0].subCategoriasID[0];
        $.each(subCategorias, function (a, v) {
            let Vres = v.find(x => x.subCategoriasEcomItemID == ParmSubCategory);
            if (Vres) {
                ParmCategory = Vres.categoriasID[0];
            }
        })

        createBreadcrums('producto');

        if (actualSubCategory != null) {
            if (actualSubCategory.ageGate) {
                checkAgeGate();
            }
        }
        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function createBreadcrums(type_) {
    var breadcrumsHTML = '';
    if (type_ == 'categorias' || type_ == 'productos' || type_ == "producto") {
        let Vres = categorias.find(x => x.categoriaID == ParmCategory);
        if (Vres) {
            breadcrumsHTML = '<span>|</span> <a href="categorias?cat=' + Vres.categoriaID + '">' + Vres.categoria + '</a> ';

            if (type_ == 'productos' || type_ == 'producto') {
                let Vres2 = subCategorias[Vres.categoriaID].find(x => x.subCategoriasEcomItemID == ParmSubCategory);
                if (Vres2) {
                    actualSubCategory = Vres2;
                    breadcrumsHTML += '<span>|</span> <a href="productos?subcat=' + Vres2.subCategoriasEcomItemID + '" class="active">' + Vres2.subCategoria + '</a>';
                }
            }
        }
    }

    $('#breadcrums').html(breadcrumsHTML);
}

function listProducts(action_) {
    var productsListHtml = '';
    var listindex = '';
    var tipodeOrdenhtml = '';
    var listaDeMarcasHtml = '';
    var listaDeMarcasArray = [];

    ParmSearch = $('#searchInput').val();

    $.ajax({
        url: apiUrl,
        data: { action: action_, subcategory: ParmSubCategory, search: ParmSearch, page: ParmPage },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.data != "") {
            var dataP_ = JSON.parse(data['data']);
            var data_ = dataP_['lsProductos'];
            cantidadDeProductos = dataP_['cantidadDeProductos'];

            if (data_.length > 0) {
                $.each(data_, function (key, val) {
                    var precioxunidad = 0;
                    if (data.userType == '3') {
                        val.listaaUsar = val.precioActual4;
                        val.precioxunidad = (val.listaaUsar / val.uxBReal).toFixed(2);
                    } else {
                        val.listaaUsar = val.precioActual1;
                        val.precioxunidad = (val.precioActual2).toFixed(2);
                        val.precioxunidadsindescuento = (val.listaaUsar).toFixed(2);
                    }
                });

                tipoDeOrden = getCookie('tipoDeOrden');
                eraseCookie('tipoDeOrden');
                filtroMarcaParam = getCookie('filtroMarca');
                eraseCookie('filtroMarca');

                switch (tipoDeOrden) {
                    case '4':
                        data_.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
                        break;
                    case '3':
                        data_.sort((a, b) => b.precioxunidad - a.precioxunidad);
                        break;
                    case '2':
                        data_.sort((a, b) => a.precioxunidad - b.precioxunidad);
                        break;
                    default:
                        break;
                }

                if (action_ != "getSearch") {
                    tipodeOrdenhtml = '  <select class="selectOrden1" id="selectOrder" name="selectOrder" onchange="selectOrder(this)">\
                        <option value=0>Tipo de orden </option>\
                        <option value=1>Mas Relevantes</option>\
                        <option value=2>Menor Precio</option>\
                        <option value=3>Mayor Precio</option>     \
                        <option value=4>A - Z</option>     \
                        </select>';

                    listaDeMarcasHtml = '  <select class="selectOrden1" id="selectMarcar" name="selectMarca" onchange="filtroMarca(this)">\
                        <option value=0>Buscar Por Marca </option>\
                        <option value=9999>TODOS </option>';
                } else {
                    tipodeOrdenhtml = '';
                    listaDeMarcasHtml = '';
                }

                $.each(data_, function (key, val) {
                    precioxunidad = val.precioxunidad;
                    listaaUsar = val.listaaUsar;

                    var nombreCorto = val.descripcion.slice(0, 50);
                    var htmlBotonAgregar = "";
                    var textoDescuento = "";
                    var fondoDestacado = "";

                    if (val.destacado) {
                        fondoDestacado = ",url(images/img_imbatibles_back.jpg)  center center / cover no-repeat ";
                    }

                    if (val.stockDisponible < 1) {
                        htmlBotonAgregar = '  <a href="javascript:;"  class="buy">POR EL MOMENTO SIN STOCK</a>';
                    } else {
                        if (val.cantiadDeUnidadesEnLaCaja > 1 && false) {
                            //agragar boton por caja
                            // htmlBotonAgregar =' <p class="qtyproduct"><span>Unidades:</span> <input type="number" value="1" class="qtyinput" min="1"  /></p><a href="javascript:;" onclick="addProductToCart('+val.productosID+', $(this).parent().find(\'input\').val())" class="buy">Agregar</a>';
                            // htmlBotonAgregarBulto =' <p class="qtyproduct"><span>Bultos :</span> <input type="number" value="1" class="qtyinput" min="1"  /></p><a href="javascript:;" onclick="addProductToCart('+val.productosID+', $(this).parent().find(\'input\').val()*'+val.cantiadDeUnidadesEnLaCaja+')" class="buy">Agregar</a>';
                        } else {
                            //     htmlBotonAgregar ='<div> <p class="qtyproduct"> <input type="number" value="1" class="qtyinput" min="1"  ><a href="javascript:;" onclick="addProductToCart('+val.productosID+', $(this).parent().find(\'input\').val())" class="buy">Comprar x '+val.uxBReal+' un.</a></p></div>';
                            htmlBotonAgregar = '<div> <p class="qtyproduct"> <a href="javascript:;" onclick="addtocartModal(' + val.productosID + ')" class="buy">Comprar</a></p></div>';
                        }
                    }

                    let marca_ = findMarca(val.marcaId);

                    if (!listaDeMarcasArray.find(e => e.id === val.marcaId)) {
                        listaDeMarcasArray.push({ id: val.marcaId, nombre: marca_ });
                    } else {
                        var g = 9;
                    }

                    var descuentoBox = '<div class="nopercent"></div>';
                    if (val.precioAnterior1 != "" && data.userType != 3) {
                        descuentoBox = '<span class="preciotachado">$' + val.precioxunidadsindescuento + '</span>';

                        var porcentajedescuento = Math.round(((precioxunidad / val.precioxunidadsindescuento) - 1) * -100, 0);

                        textoDescuento = '<span class="iconOFF">&nbsp;&nbsp;-' + porcentajedescuento + '% &nbsp;</span>';

                        if (porcentajedescuento < 1) {
                            descuentoBox = ' <span class=""> &nbsp;&nbsp; </span>';
                            textoDescuento = '';
                        }
                    }

                    if (filtroMarcaParam == null || filtroMarcaParam == val.marcaId) {
                        productsListHtml += '<div class="col-6 col-md-3">\
                        <div class="pitem" >\
                            <div class="pitemInner" onclick="addtocartModal('+ val.productosID + ')">\
                                <div class="photo" style="background:url('+ val.imagen + ') center center / cover no-repeat' + fondoDestacado + ';" ></div>\
                                <h4>'+ nombreCorto + '</h4>\
                                <p><b>'+ marca_ + '</b></p>\
                                '+ descuentoBox + '\
                                <div class="nopercent"> $'+ precioxunidad + ' ' + textoDescuento + '</div>\
                                </div>\
                                '+ htmlBotonAgregar + ' \
                                </div>\
                        </div>';
                    }
                });

                //verificar para mostrar siguiente
                checkNextPagination();
            } else {
                $('#noresults').show();
                $('#pagination').hide();
            }
        } else {
            $('#noresults').show();
            $('#pagination').hide();
        }

        listindex = '<div class="productos_list"  id="productos_list" ><div class="row" id="response_list_products"></div>';

        if (productsListHtml != '') {
            $('#noresults').hide();
        }

        ////// generar lista de marcas ordenada
        listaDeMarcasArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
        $.each(listaDeMarcasArray, function (key, val) {
            listaDeMarcasHtml += '<option value=' + val.id + '>' + val.nombre + '</option>';
        });

        listaDeMarcasHtml += '  </select>';

        if (action_ == "getSearch") {
            listaDeMarcasHtml = '';
        }

        $('#listaDeMarcasHtml').html(listaDeMarcasHtml);
        $('#tipodeOrdenhtml').html(tipodeOrdenhtml);
        $('#productos_listindex').html(listindex);
        $('#response_list_products').html(productsListHtml);

        setTimeout(() => {
            $('#loadingList').hide();
        }, 500);

        showLoading(false);

        return false;
    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);

        return false;
    });
}

function checkNextPagination() {
    if (ParmPage == "") { ParmPage = 1; }

    if (ParmPage == "" || ParmPage == 1 || ParmPage == 0) {
        $('#pagBack').hide();
    } else {
        $('#pagBack').show();
    }

    var productosMostrados = (productPagination * ParmPage);

    if (productosMostrados >= cantidadDeProductos) {
        $('#pagNext').hide();
    } else {
        $('#pagNext').show();
    }
}

function paginationLink(goto_) {
    var toAction = "getProducts";
    if (actualPage == 'busqueda') {
        toAction = 'getSearch';
    } else if (actualPage == 'ofertas') {
        toAction = 'getOfertas';
    }

    if (goto_ == "anterior" && ParmPage > 1) {
        ParmPage = ParmPage * 1 - 1;
        listProducts(toAction);
    }

    if (goto_ == "siguiente") {
        if (ParmPage == "") {
            ParmPage = 2;
        } else {
            ParmPage = ParmPage * 1 + 1;
        }
        //console.log("nextpage:" + ParmPage);
        listProducts(toAction);
    }
}

function getCart() {
    $.ajax({
        url: apiUrl,
        data: { action: 'getCart' },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        addProductCartHeader(data.data.cart, data.data.cart_combo);
        updateCartTotal(data.data);
    }).fail(function (data) {
        //console.log("Err: " + data);
    });
}

function gotoProduct(id_producto) {
    setTimeout(() => {
        if (!clickToAddCart) {
            saveViewProduct(id_producto);
            window.location = 'producto?producto_id=' + id_producto;
        }
    }, 50);
}

var clickToAddCart = false;

function addProductToCart(val_, qty = 1) {
    if (isNaN(qty)) {
        swal('Debes ingresar un valor mayor a 0');
    } else {
        clickToAddCart = true;

        $.ajax({
            url: apiUrl,
            data: { action: 'addProductToCart', producto_id: val_, cantidad: qty },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            clickToAddCart = false;
            
            if (data.state == 'error') {
                swal("Atencion", data.message, "warning")
            } else {
                $.each(data.data.cart, function (k, v) {
                    if (v.producto.data.productosID == val_) {
                        $('#inputProducto').val(v.cantidad * v.producto.data.uxBReal);

                        var subTotalProducto = (v.cantidad * v.producto.precio).toFixed(2);
                        var cantenCartHtml = '';

                        cantenCartHtml = '  <i class="fa badge fa-2x"  value=' + v.cantidad + '>&#xf07a;</i><i>$ ' + subTotalProducto + ' </i>';

                        $("#cantenCartHtml").addClass("highlightCart");
                        setTimeout(function () {
                            $("#cantenCartHtml").removeClass('highlightCart');
                        }, 1000);

                        $('#cantenCartHtml').html(cantenCartHtml);
                        addProductCartHeader(data.data.cart, data.data.cart_combo);
                        updateCartTotal(data.data);

                        if (v.producto.data.uxBReal > 1) {
                            $('#detallexbulto').html('<div class="alert alert-success">Llevas ' + v.cantidad + ' Cajas de ' + v.producto.data.uxBReal + ' unidades</div>');
                            $('#detallexbulto').show();
                        } else {
                            $('#detallexbulto').html = '';
                            $('#detallexbulto').hide();
                        }
                    }
                })

                //abrir popup header cart
                if (!$("#mycart .openmenu").next(".panel").hasClass("active")) {
                    if ($(window).width() > 768) {
                        $("#mycart .openmenu").trigger("click");
                    }
                }

                //scroll de combo header & highlight
                scrollComboHeader(val_);
            }

            showLoading(false);

            return false;
        }).fail(function (data) {
            showLoading(false);
            //console.log("Err: " + data);

            return false;
        });
    }
}

function scrollComboHeader(val_) {
    $('#header_response_items_container').animate({
        scrollTop: $("#cartProduct_" + val_).offset().top
    }, 600, function () {
        setTimeout(() => {
            $("#cartProduct_" + val_).addClass("highlight");
            setTimeout(function () {
                $("#cartProduct_" + val_).removeClass('highlight');
            }, 2000);
        }, 200);
    });

    $("#headerCartIcon").addClass("highlight");
    setTimeout(function () {
        $("#headerCartIcon").removeClass('highlight');
    }, 2000);
}

function addProductCartHeader(cart_, combo_cart_) {
    $('#response_header_cart').html('');
    $('#response_checkout_cart').html('');

    var htmlProductItem = "";

    if (cart_ != null) {
        $.each(cart_, function (k, v) {
            let marca_ = findMarca(v.producto.data.marcaId);

            htmlProductItem += '<li id="cartProduct_' + v.producto.data.productosID + '">\
                <div class="thumb" >\
                    <span class="img" style="background:url('+ v.producto.data.imagenThumb + ') center center / cover no-repeat;"></span>\
                    <a href="javascript:;" onclick="deleteFromCart('+ v.producto.data.productosID + ')" class="delete"></a>\
                </div>\
                <div class="info">\
                    <span class="title">'+ v.producto.data.descripcion + '</span>\
                    <span class="marca">'+ marca_ + '</span>\
                    <span class="precio">$'+ v.producto.precio + '</span>\
                </div>\
                <div class="product_count">\
                    <a href="javascript:;" onclick="sumCartItem('+ v.producto.data.productosID + ', \'sum\')" class="add">+</a>\
                    <input type="number" value="'+ v.cantidad + '" min="1" onchange="updateCartItemAmount(' + v.producto.data.productosID + ', this.value, $(this))" class="value">\
                    <a href="javascript:;" onclick="sumCartItem('+ v.producto.data.productosID + ', \'rest\')" class="remove">-</a>\
                </div>\
            </li>';
        });
    }

    $('#response_header_cart').html(htmlProductItem);
    $('#response_checkout_cart').html(htmlProductItem);

    var htmlComboItem = '';

    if (combo_cart_ != null) {
        $.each(combo_cart_, function (k, v) {
            htmlComboItem += '<li id="comboItem_' + v.comboData.idCombo + '">\
                <div class="thumb" >\
                    <span class="img" style="background:url('+ v.comboData.urlImagen + ') center center / cover no-repeat;"></span>\
                    <a href="javascript:;" onclick="deleteComboItemFromCart('+ k + ')" class="delete"></a>\
                </div>\
                <div class="info">\
                    <span class="title"><a href="javascript:showComboPopup('+ k + ')">' + v.comboData.nombre + '</a></span>\
                    <span class="precio">$'+ v.total + '</span>\
                </div>\
                <div class="product_count">\
                    <span class="value">'+ v.cantidad + '</span>\
                </div>\
            </li>';
        });
    }

    if (htmlComboItem != '' || htmlProductItem != '') {
        $('#itemincart').show();
    } else {
        $('#itemincart').hide();
    }

    $('#response_header_cart_combos').html(htmlComboItem);
    $('#response_checkout_cart_combos').html(htmlComboItem);
}

function showComboPopup(idCombo_) {
    showLoading();
    $.ajax({
        url: apiUrl,
        data: { action: 'showComboPopup', id_combo: idCombo_ },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.data != null) {
            $('#response_combopopup_detail').html(data.data.comboData.nombre);

            if (data.data.comboData.porcentajedescuento != 0) {
                $('#response_combopopup_discount_container').show();
                $('#response_combopopup_discount').html('Descuento ' + data.data.comboData.porcentajedescuento + ' %');
            } else {
                $('#response_combopopup_discount_container').hide();
            }

            $('#response_combopopup_subtotal').html(data.data.subtotal);
            $('#response_combopopup_total').html(data.data.total);

            var htmlProductItem = '';
            var htmlProductItemSinCargo = '';

            htmlProductItem = getComboListProducts(data.data.productos);
            htmlProductItemSinCargo = getComboListProductsFree(data.data.productos_sincargo);

            $('#response_combopopup_products').html(htmlProductItem);

            if (htmlProductItemSinCargo != "") {
                $('#response_combopopup_products_free_container').show();
                $('#response_combopopup_products_free').html(htmlProductItemSinCargo);
            } else {
                $('#response_combopopup_products_free_container').hide();
            }

            $('#panel_combodata').addClass("active");
        }

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function deleteComboItemFromCart(idCombo_) {
    if (confirm("Borrar este combo del carrito?")) {
        showLoading();
        $.ajax({
            url: apiUrl,
            data: { action: 'deleteCombo', id_combo: idCombo_ },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            addProductCartHeader(data.data.cart, data.data.cart_combo);
            updateCartTotal(data.data);
            showLoading(false);

            return false;
        }).fail(function (data) {
            showLoading(false);
            //console.log("Err: " + data);

            return false;
        });
    }
}

function updateCartTotal(responseCart) {
    var amn = 0;
    if (responseCart.cart != null) {
        $.each(responseCart.cart, function (k, v) {
            amn += v.cantidad * 1;
        });
    }

    if (responseCart.cart_combo != null) {
        $.each(responseCart.cart_combo, function (k, v) {
            amn += 1;
        });
    }

    $('#response_header_cart_am').html(amn);
    $('#response_checkout_cart_am').html(amn);

    $('#response_header_cart_total').html('$' + responseCart.totalPrecio1);
    $('#response_checkout_cart_total').html('$' + responseCart.totalPrecio1);

    $('#response_header_cart_subtotal').html('$' + responseCart.totalPrecio1);
    $('#response_checkout_cart_subtotal').html('$' + responseCart.totalPrecio1);

    var textoConSubtotales = responseCart.totalPrecio1

    if (responseCart.totalPrecio1 < 15000) {
        var progresoCompra = parseInt(((responseCart.totalPrecio1).toFixed(2) / 15000) * 100);
        $('#response_infoTotales_cart_subtotal').html('<div class="progress">\
        <div class="progress-bar" role="progressbar" style="width: '+ progresoCompra + '%;" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">' + responseCart.totalPrecio1.toFixed(2) + ' $</div>  </div>');
    } else {
        $('#response_infoTotales_cart_subtotal').html('');
    }

    $('#response_checkout_cart_tipodeFC').html(responseCart.facturarCF);

    if (responseCart.totalConDescuento == responseCart.totalaPagar) {
        $('#response_header_cart_total_totalaPagar').html('$' + responseCart.totalaPagar);
        $('#response_checkout_cart_total_totalaPagar').html('$' + responseCart.totalaPagar);
    } else {
        $('#response_header_cart_total_totalaPagar').html('$' + responseCart.totalaPagar);
        $('#response_checkout_cart_total_totalaPagar').html('$' + responseCart.totalaPagar);
    }

    //calculo nuevo de descuentos:
    if (responseCart.descuentoDescripcion != '0') {
        $('#response_header_cart_discount').html(responseCart.descuentoDescripcion);
        $('#response_checkout_cart_discount').html(responseCart.descuentoDescripcion);
    } else {
        $('#response_header_cart_discount').html('');
        $('#response_checkout_cart_discount').html('');
    }

    if (responseCart.percepciones != '9999') {
        $('#response_header_cart_percepciones').html('$' + responseCart.percepciones);
        $('#response_checkout_cart_percepciones').html('$' + responseCart.percepciones);
        $('#response_header_cart_percepciones2').html('$' + responseCart.percepciones2);
        $('#response_checkout_cart_percepciones2').html('$' + responseCart.percepciones2);
        $('#response_header_cart_percepciones3').html('$' + responseCart.percepciones3);
        $('#response_checkout_cart_percepciones3').html('$' + responseCart.percepciones3);

        $('#response_header_cart_percepcionesDescripcion').html(responseCart.percepcionesDescripcion);
        $('#response_checkout_cart_percepcionesDescripcion').html(responseCart.percepcionesDescripcion);

        $('#response_header_cart_percepcionesDescripcion2').html(responseCart.percepcionesDescripcion2);
        $('#response_checkout_cart_percepcionesDescripcion2').html(responseCart.percepcionesDescripcion2);

        $('#response_header_cart_percepcionesDescripcion3').html(responseCart.percepcionesDescripcion3);
        $('#response_checkout_cart_percepcionesDescripcion3').html(responseCart.percepcionesDescripcion3);
    } else {
        $('#response_header_cart_percepciones').html('');
        $('#response_checkout_cart_percepciones').html('');

        $('#response_header_cart_percepciones2').html('');
        $('#response_checkout_cart_percepciones2').html('');

        $('#response_header_cart_percepciones3').html('');
        $('#response_checkout_cart_percepciones3').html('');

        $('#response_header_cart_percepcionesDescripcion').html('');
        $('#response_checkout_cart_percepcionesDescripcion').html('');
        $('#response_header_cart_percepcionesDescripcion2').html('');
        $('#response_checkout_cart_percepcionesDescripcion2').html('');
        $('#response_header_cart_percepcionesDescripcion3').html('');
        $('#response_checkout_cart_percepcionesDescripcion3').html('');
    }
}

function cart_header_deleteall() {
    if (confirm("Â¿Desea vaciar el carrito?")) {
        showLoading(true);
        $.ajax({
            url: apiUrl,
            data: { action: 'cart_header_deleteall' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            addProductCartHeader(data.data.cart, data.data.cart_combo);
            updateCartTotal(data.data);
            showLoading(false);

            return false;
        }).fail(function (data) {
            showLoading(false);
            //console.log("Err: " + data);

            return false;
        });
    }
}

function deleteFromCart(product_id) {
    showLoading();
    $.ajax({
        url: apiUrl,
        data: { action: 'deleteProductFromCart', product_id: product_id },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        addProductCartHeader(data.data.cart, data.data.cart_combo);
        updateCartTotal(data.data);
        showLoading(false);
    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);
    });
}

function updateCartItemAmount(product_id, am, that, multiplo) {
    var AlertCantidadporBulto = false;
    var cantRedondeada = Math.floor(am / multiplo);
    if (am != 0) {
        if (cantRedondeada != am / multiplo) {
            AlertCantidadporBulto = true;
        }

        if (am != 0 && cantRedondeada == 0) {
            am = 1;
        } else {
            am = cantRedondeada;
        }
    }

    if (am <= 0) {
        swal('Debes ingresar un valor mayor a 0');
    } else {
        showLoading();
        $.ajax({
            url: apiUrl,
            data: { action: 'updateCartItemAmount', producto_id: product_id, amount: am },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                showLoading(false);
                swal("Atencion", data.message, "warning")
                that.val(data.cantidad_anterior);
            } else {
                addProductCartHeader(data.data.cart, data.data.cart_combo);
                updateCartTotal(data.data);

                $('#inputProducto').val(am * multiplo);

                var subTotalProducto = (am * data.data.cart[product_id]['producto']['precio']).toFixed(2);

                var cantenCartHtml = '';

                cantenCartHtml = ' <i class="fa badge fa-2x" value=' + am + '>&#xf07a;</i><i>$ ' + subTotalProducto + ' </i>';

                if (multiplo > 1) {
                    $('#detallexbulto').html('<div class="alert alert-success">Llevas ' + am + ' Cajas de ' + multiplo + ' unidades</div>');
                    $('#detallexbulto').show();
                } else {
                    $('#detallexbulto').html = '';
                    $('#detallexbulto').hide();
                }

                if (am == 0) {
                    $('#detallexbulto').html = '';
                    $('#detallexbulto').hide();
                    $('#inputProducto').val(0);
                }

                if (AlertCantidadporBulto) {
                    $('#AlertCantidadporBulto').html('<div class="alert alert-danger ">Se venden por caja de ' + multiplo + ' unidades</div>');
                    $('#AlertCantidadporBulto').show();
                    setTimeout(function () { $("#AlertCantidadporBulto").hide(); }, 3000);
                } else {
                    $('#AlertCantidadporBulto').hide();
                }

                $('#cantenCartHtml').html(cantenCartHtml);
            }

            showLoading(false);

            return false;
        }).fail(function (data) {
            showLoading(false);
            //console.log("Err: " + data);

            return false;
        });
    }
}

function sumCartItem(product_id, sumaction) {
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'sumProductToCart', producto_id: product_id, sumaction: sumaction },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal("Atencion", data.message, "warning")
        } else {
            addProductCartHeader(data.data.cart, data.data.cart_combo);
            updateCartTotal(data.data);
        }

        showLoading(false);

        return false;
    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);

        return false;
    });
}

function getCompraDetalle(id_transaccion) {
    showLoading();
    $.ajax({
        url: apiUrl,
        data: { action: 'getCompraDetalle', id_transaccion: id_transaccion },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            $('#compraDetalle').html(data.data);
            showAlert(data.message);

            function showAlert() {
                alert(data.data);
            }
        }
        showLoading(false);

    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);
    });
}

function showLoading(show_ = true) {
    if (show_)
        $('#loading').show();
    else
        $('#loading').hide();
}

function getProductosDestacados_post(data_) {
    var productsListHtml = '';

    $.each(data_.lsProductos, function (key, val) {
        if (getCookie('tipoUsuario') == 3) {
            listaaUsar = val.precioActual4;
            precioxunidad = (listaaUsar / val.uxBReal).toFixed(2);
        } else {
            listaaUsar = val.precioActual1;
            precioxunidad = (val.precioActual2).toFixed(2);
        }

        let marca_ = findMarca(val.marcaId);

        htmlBotonAgregar = '<div> <p class="qtyproduct"> <a href="javascript:;" onclick="addtocartModal(' + val.productosID + ')" class="buy">Comprar</a></p></div>';

        productsListHtml += '<div class="citem">\
            <div class="ci_w" onclick="addtocartModal('+ val.productosID + ')">\
                <div class="ci_a">\
                    <div class="photo" style="background:url('+ val.imagenThumb + ') center center / cover no-repeat;" ></div>\
                </div>\
                <div class="ci_b">\
                    <h3>'+ val.descripcion + '</h3>\
                    <h4>'+ marca_ + '</h4>\
                    <div class="nopercent"> $'+ precioxunidad + '</div>\
                    </div>\
                    </div>\
            </div>';
    });

    if (data_.lsProductos.length > 0) {
        $('#product_category_car').show();
        $('#category_product_list').removeClass('margin');
    } else {
        //$('#category_product_list').addClass('margin');
    }

    //console.log(productsListHtml);
    $('#response_featured_products').html(productsListHtml);

    //create carrousel..
    setTimeout(() => {
        $('.category_n1_owl-carousel').owlCarousel({
            loop: true,
            margin: 0,
            responsiveClass: true,
            dots: false,
            responsive: {
                0: {
                    items: 1,
                    nav: true
                }
            }
        })
    }, 500);

    return false;
}

function getProductosDestacados() {
    var idparacookie = ("0000" + ParmSubCategory).substr(-4) + ("0000" + ParmCategory).substr(-4);
    var ProductosDestacadosSession = sessionStorage.getItem(idparacookie);
    var ti = Date.now() - getCookie(idparacookie + '_time');

    if (ProductosDestacadosSession != null && ti < time_cache) {
        getProductosDestacados_post(JSON.parse(ProductosDestacadosSession));
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getProducts', subcategory: ParmSubCategory, category: ParmCategory, destacado: true },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            var data_ = JSON.parse(data['data']);
            getProductosDestacados_post(data_);
            setCookie(idparacookie + '_time', Date.now());
            sessionStorage.setItem(idparacookie, data['data']);
        }).fail(function (data) {
            //console.log("Err: " + data);

            return false;
        });
    }
}

function getHomeBanners() {
    let homeBannerPoints = '';
    let homeBannerItems = '';
    let pointN = 0;
    let bannerList = [
        "https://distrisuronline.com/images/ba13.png",
        "https://distrisuronline.com/images/ba14.png",
        "https://distrisuronline.com/images/ba15.png"
    ];

    bannerList.forEach(function (ba) {
        let isActive = (pointN == 0) ? 'active' : '';
        homeBannerPoints += '<li data-target="#homebannerCarousel" data-slide-to="' + pointN + '" class="' + isActive + '"></li>';

        homeBannerItems += '<div style="background:url(' + ba + ') center center / cover no-repeat;" class="carousel-item ' + isActive + '">\
                    <span style="background:url('+ ba + ') center center / contain no-repeat;" class="homebanner_mobile"></span>\
                </div>';
        pointN++;
    });

    $('#homeBannerPoints').html(homeBannerPoints);
    $('#homeBannerItems').html(homeBannerItems);

    showLoading(false);
}

var viewedProducts = [];

function saveViewProduct(id_producto) {
    viewedProducts.push(id_producto);
    setCookie('viewedProducts', JSON.stringify(viewedProducts));
}

function loadViewProduct() {
    let viewedProducts_ = getCookie('viewedProducts');
    if (viewedProducts_ != null) { viewedProducts = JSON.parse(viewedProducts_); }
}

function showMostViewProduct_post(data_) {
    var userType = getCookie('tipoUsuario');
    productsListHtml = '';

    if (data_.length > 0) {
        $.each(data_, function (key, val) {
            if (userType == 3) {
                listaaUsar = val.precioActual4;
                precioxunidad = (listaaUsar / val.uxBReal).toFixed(2);
            } else {
                listaaUsar = val.precioActual1;
                precioxunidad = (val.precioActual2 / val.uxBReal).toFixed(2);
            }

            let marca_ = findMarca(val.marcaId);

            if (val.precioAnterior1 != "" && userType != 3) {
                descuentoBox = '<div class="percent">' + val.precioAnterior1 + '</div>';
                descuentoBox += '<span class="percent">$' + val.precioActual2 + '</span>';
            }

            htmlBotonAgregar = '<div> <p class="qtyproduct"> <a href="javascript:;" onclick="addtocartModal(' + val.productosID + ')" class="buy">Comprar</a></p></div>';

            productsListHtml += '<div class="pitem " >\
                   <div class="pitemInner" onclick="addtocartModal('+ val.productosID + ')">\
                       <div class="photo" style="background: url('+ val.imagen + ') center center / cover no-repeat,url(images/img_imbatibles_back.jpg)  center center / cover no-repeat ;" ></div>\
                       <h3>'+ val.descripcion + '</h3>\
                       <h4>'+ marca_ + '</h4>\
                       <div class="nopercent"> $'+ precioxunidad + ' x Un.</div>\
                       </div>\
               </div>';
        });

        $('#loadingMostViewed').hide();
        $('#response_mostViewProducts').html(productsListHtml);

        //create carrousel..
        let isCarouselLoop = false;
        if (mobilecheck() || data_.length > 4) {
            isCarouselLoop = true;
        }

        setTimeout(() => {
            $('.home_owl-carouselMVResponse').owlCarousel({
                center: true,
                loop: isCarouselLoop,
                margin: 40,
                responsiveClass: true,
                dots: false,
                responsive: {
                    0: {
                        items: 1,
                        nav: true
                    },
                    768: {
                        items: 5,
                        nav: true
                    },
                    1000: {
                        items: 5,
                        nav: true
                    }
                }
            })
        }, 500);

    } else {
        $('#loadingMostViewed').hide();
        $('#productos_mas_vistos').hide();
    }
}

function showMostViewProduct() {
    var mostViewed = sessionStorage.getItem('mostViewed');
    var ti = Date.now() - getCookie('mostViewed_time');

    if (mostViewed != null && ti < time_cache) {
        showMostViewProduct_post(JSON.parse(mostViewed));
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getMostViewed' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            showMostViewProduct_post(data['data']);
            sessionStorage.setItem('mostViewed', JSON.stringify(data['data']));
            setCookie('mostViewed_time', Date.now());
        }).fail(function (data) {
            //console.log("Err: " + data);
        });
    }
}

function showViewProduct() {
    if (viewedProducts.length > 0) {
        $.ajax({
            url: apiUrl,
            data: { action: 'getProductsById', productsIds: viewedProducts },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            var data_ = data.data;
            productsListHtml = '';

            $.each(data_, function (key, val) {
                if (data.userType == 3) {
                    listaaUsar = val.precioActual4;
                } else {
                    listaaUsar = val.precioActual1;
                }

                let marca_ = findMarca(val.marcaId);
                var descuentoBox = '<div class="nopercent"></div>';
                if (val.precioAnterior1 != "" && data.userType != 3) {
                    descuentoBox = '<div class="percent">' + val.precioAnterior1 + '</div>';
                    descuentoBox += '<span class="percent">$' + val.precioActual2 + '</span>';
                }

                productsListHtml += '<div class="pitem" >\
                    <div class="pitemInner" onclick="addtocartModal('+ val.productosID + ')">\
                        <div class="photo" style="background:url('+ val.imagenThumb + ') center center / cover no-repeat;" ></div>\
                        <h3>'+ val.descripcion + '</h3>\
                        <h4>'+ marca_ + '</h4>\
                        '+ descuentoBox + '\
                        <div class="price">$'+ listaaUsar + '</div>\
                    </div>\
                    <p class="qtyproduct"><span>Cantidad:</span> <input type="number" value="1" class="qtyinput" min="1"  /></p>\
                    <a href="javascript:;" onclick="addtocartModal('+ val.productosID + ', $(this).parent().find(\'input\').val())" class="buy">Agregar</a>\
                </div>';
            });

            $('#response_recentViewProducts').html(productsListHtml);
            $('#loadingRecentViewed').hide();

            //create carrousel..
            let isCarouselLoop = false;
            if (mobilecheck() || data_.length > 4) {
                isCarouselLoop = true;
            }

            setTimeout(() => {
                $('.home_owl-carouselResponse').owlCarousel({
                    center: true,
                    loop: isCarouselLoop,
                    margin: 40,
                    responsiveClass: true,
                    dots: false,
                    responsive: {
                        0: {
                            items: 1,
                            nav: true
                        },
                        768: {
                            items: 5,
                            nav: true
                        },
                        1000: {
                            items: 5,
                            nav: true
                        }
                    }
                })
            }, 500);
        }).fail(function (data) {
            //console.log("Err: " + data);
        });
    } else {
        $('#loadingRecentViewed').hide();
        $('#productos_recientes').hide();
    }
}

function getComboData() {
    var comboQt=0;
    if(actualPage == 'combo_productos2'){
        comboQt=1;
    } else{
         comboQt = $('#combo_quantity_input').val();
    }

    if (!isNaN(comboQt)) {
        showLoading();
        $.ajax({
            url: apiUrl,
            data: { action: 'getComboData', id_combo: ParmComboId },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                //console.log(data.data.cantidad);
                $('#combo_description').html(data.data.comboData.descripcion);
                cantidadConCargo = data.data.comboData.cantidadConCargo;
                $('#comboproductofaltanteincart').html('Necesitas agregar ' + cantidadConCargo + '  productos');

                var urlimg = data.data.comboData.urlImagen;

                checkImageExists(urlimg, function (url, result) {
                    if (result == "error") {
                        urlimg = "images/default.jpg";
                        htmlfotocombo = '<div align=center><br><img src="' + urlimg + '" class="w3-display-middle w3-large" alt="" style="width:70%" center center></div>';
                        $('#combo_foto').html(htmlfotocombo);
                    } else {
                        htmlfotocombo = '<div align=center><br><img src="' + urlimg + '" class="w3-display-middle w3-large" alt="" style="width:70%" center center></div>';
                        $('#combo_foto').html(htmlfotocombo);
                    }
                })

                if (data.data.cantidad != null && data.data.cantidad != '' && data.data.cantidad != 0) {
                    $('#combo_list_products').show();
                    $('#combo_quantity').hide();
                    $('#comboSideCart').show();
                    getComboProductos();
                    $('#comboatincart').html(data.data.cantidad);
                } else {
                    $('#combo_list_products').hide();
                    $('#combo_quantity').show();
                }
            }

            showLoading(false);
        }).fail(function (data) {
            //console.log("Err: " + data);
            showLoading(false);
        });
    } else {
        alert("Ingresa un valor numerico");
    }
}

function getComboProductos() {
    var productsListHtml = '';
    var productsListFreeHtml = '';

    $('#response_list_products').html(productsListHtml);
    $('#response_list_products_free').html(productsListFreeHtml);

    $.ajax({
        url: apiUrl,
        data: { action: 'getComboProductos', id_combo: ParmComboId },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.data != "") {
            if (data.data.comboData != null && data.data.comboData != "") {
                if (data.data.productosConCargo != null) {
                    var data_ = data.data.productosConCargo;
                    var i = 1;
                    $.each(data_, function (key, val) {
                        checkImageExists(val.imagenThumb, function (url, result) {
                            var bgImage = url;
                            if (result == "error") { bgImage = "images/default.jpg"; }

                            var descuentoBox = '<div class="nopercent"></div>';
                            if (val.precioAnterior1 != "" && data.userType != 3) {
                                descuentoBox = '<div class="percent">' + val.precioAnterior1 + '</div>';
                            }

                            if (data.userType == 3) {
                                listaaUsar = val.precioActual4;
                            } else {
                                listaaUsar = val.precioActual1;
                            }

                            // validar stock de items del combo
                            var htmlBotonAgregar = "";
                            if (val.stockDisponible < 1) {
                                //html sin stock
                                htmlBotonAgregar = '<p class="qtyproduct"><span></span> </p>  <a href="javascript:;"  class="buy">POR EL MOMENTO SIN STOCK</a>';
                            } else {
                                //html con stock  add cart
                                htmlBotonAgregar = ' <p class="qtyproduct"><span>Cantidad:</span> <input type="number" value="1" class="qtyinput" min="1"  /></p><a href="javascript:;" onclick="addProductToCombo(' + val.productosID + ', ' + ParmComboId + ', $(this).parent().find(\'input\').val(),\'cc\')" class="buy">Agregar</a>';
                            }

                            let marca_ = findMarca(val.marcaId);
                            productsListHtml += '<div class="col-6 col-md-3">\
                                <div class="pitem" >\
                                    <div class="photo" style="background:url('+ bgImage + ') center center / cover no-repeat;" ></div>\
                                    <h3>'+ val.descripcion + '</h3>\
                                    <h4>'+ marca_ + '</h4>\
                                    '+ descuentoBox + '\
                                    <div class="price">$'+ listaaUsar + '</div>' + htmlBotonAgregar + '\
                                  </div>\
                            </div>';

                            if (i >= data_.length) {
                                $('#response_list_products').html(productsListHtml);
                            }

                            i++;
                        })
                    });
                }

                if (data.data.productosSinCargo != null && data.data.productosSinCargo != "") {
                    var data_ = data.data.productosSinCargo;
                    var j = 1;

                    $.each(data_, function (key, val) {
                        checkImageExists(val.imagenThumb, function (url, result) {
                            var bgImage = url;
                            if (result == "error") { bgImage = "images/default.jpg"; }

                            let marca_ = findMarca(val.marcaId);

                            var descuentoBox = '<div class="nopercent"></div>';
                            if (val.precioAnterior1 != "" && data.userType != 3) {
                                descuentoBox = '<div class="percent">' + val.precioAnterior1 + '</div>';
                            }

                            if (data.userType == 3) {
                                listaaUsar = val.precioActual4;
                            } else {
                                listaaUsar = val.precioActual1;
                            }

                            var htmlBotonAgregar = "";
                            if (val.stockDisponible < 1) {
                                //html sin stock
                                htmlBotonAgregar = '<p class="qtyproduct"><span></span> </p>  <a href="javascript:;"  class="buy">POR EL MOMENTO SIN STOCK</a>';
                            } else {
                                //html con stock  add cart
                                htmlBotonAgregar = ' <p class="qtyproduct"><span>Cantidad:</span> <input type="number" value="1" class="qtyinput" min="1"  /></p><a href="javascript:;" onclick="addProductToCombo(' + val.productosID + ', ' + ParmComboId + ', $(this).parent().find(\'input\').val() , \'sc\')" class="buy">Agregar</a>';
                            }

                            productsListFreeHtml += '<div class="col-6 col-md-3">\
                                <div class="pitem" >\
                                    <div class="photo" style="background:url('+ bgImage + ') center center / cover no-repeat;" ></div>\
                                    <h3>'+ val.descripcion + '</h3>\
                                    <h4>'+ marca_ + '</h4>\
                                    '+ descuentoBox + '\
                                    <div class="price">$'+ listaaUsar + '</div>' + htmlBotonAgregar + '\
                                </div>\
                            </div>';

                            if (j >= data_.length) {
                                $('#response_list_products_free').html(productsListFreeHtml);
                            }

                            j++;
                        })
                    });
                }
            } else {
                window.location = 'combos';
            }
        }

        setTimeout(() => {
            $('#loadingList').hide();
            $('#loadingList2').hide();
        }, 1500);

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function submitComboEstatico(ParmComboId) {
    var comboQt=1;
    
    $.ajax({
        url: apiUrl,
        data: { action: 'submitComboEstatico', cantidad: comboQt, id_combo: ParmComboId },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            $('#comboatincart').html(comboQt);
            $('#combo_list_products').show();
            $('#combo_quantity').hide();
            getComboProductos();
        }

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function submitComboQuantity() {
    var comboQt = $('#combo_quantity_input').val();

    if (!isNaN(comboQt)) {
        if (comboQt < 1) {
            comboQt = 1;
        } else {
            showLoading();

            $.ajax({
                url: apiUrl,
                data: { action: 'submitComboQuantity', cantidad: comboQt, id_combo: ParmComboId },
                dataType: 'json',
                method: 'post'
            }).done(function (data) {
                if (data.state == 'error') {
                    showAlert(data.message);
                } else {
                    $('#comboatincart').html(comboQt);
                    $('#combo_list_products').show();
                    $('#combo_quantity').hide();
                    getComboProductos();
                }
                showLoading(false);

            }).fail(function (data) {
                //console.log("Err: " + data);
                showLoading(false);
            });
        }
    } else {
        alert("Ingresa un valor numerico");
    }
}

function addProductToCombo(id_product, id_combo, qty = 1, tipoProducto) {
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'addProductToCombo', id_product: id_product, id_combo: id_combo, cantidad: qty,tipoProducto },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal('Atencion', data.message, 'warning');
        } else {
            updateComboCart(data, true);

            $('#comboproductofaltanteincart').html(' Ca ' + data.cantfaltante + ' productos mas para completar el combo.');

            if (data.check_cantidad) {
                //se saltea validacion y carga el combo
                // getComboData();
                //cantidadConCargo = 1000;
                //     closeCombo();
                //    swal('Agregado al carrito', '', 'success');

                /// $('#comboOptions').show();
                //$('#combo_list_products').hide();
                //$('#combo_list_products').hide();
            }
        }

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function addProductToCombo_orginal(id_product, id_combo, qty = 1) {
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'addProductToCombo', id_product: id_product, id_combo: id_combo, cantidad: qty },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal('Atencion', data.message, 'warning');
        } else {
            updateComboCart(data, true);
            $('#comboproductofaltanteincart').html(' Necesitas agregar ' + data.cantfaltante + ' productos mas para completar el combo.');

            if (data.check_cantidad) {
                closeCombo();
                swal('Agregado al carrito', '', 'success');
            }
        }

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function deleteFromComboCart() {

}

function getComboListProducts(comboProducts) {
    var htmlProductItem = '';
    $.each(comboProducts, function (a, v) {
        let marca_ = findMarca(v.marcaId);
        htmlProductItem += '<li id="cartProduct_' + v.producto.data.productosID + '">\
            <div class="thumb" >\
                <span class="img" style="background:url('+ v.producto.data.imagenThumb + ') center center / cover no-repeat;"></span>\
            </div>\
            <div class="info">\
                <span class="title">'+ v.producto.data.descripcion + '</span>\
                <span class="marca">'+ marca_ + '</span>\
                <span class="precio">$'+ v.producto.precio + '</span>\
            </div>\
            <div class="product_count">\
                <span class="value">'+ v.producto.cantidad + '</span>\
            </div>\
        </li>';
    });

    return htmlProductItem;
}

function getComboListProductsFree(comboProducts) {
    var htmlProductItem = '';
    if (comboProducts) {
        $.each(comboProducts, function (a, v) {
            let marca_ = findMarca(v.marcaId);
            htmlProductItem += '<li id="cartProduct_' + v.producto.data.productosID + '">\
                <div class="thumb" >\
                    <span class="img" style="background:url('+ v.producto.data.imagenThumb + ') center center / cover no-repeat;"></span>\
                </div>\
                <div class="info">\
                    <span class="title">'+ v.producto.data.descripcion + '</span>\
                    <span class="marca">'+ marca_ + '</span>\
                    <span class="precio">$'+ v.producto.precio + '</span>\
                </div>\
                <div class="product_count">\
                    <span class="value">'+ v.producto.cantidad + '</span>\
                </div>\
            </li>';
        });
    }

    return htmlProductItem;
}

function updateComboCart(data, fromaddProduct = false) {
    if (data.combo_cart != null && data.combo_cart.total != null) {
        $('#response_combocart_subtotal').html(data.combo_cart.subtotal);
        $('#response_combocart_total').html(data.combo_cart.total);

        var htmlProductItem = '';
        var htmlProductItemSinCargo = '';

        htmlProductItem = getComboListProducts(data.combo_cart.productos);

        var cantProdSinCargo = 0;

        if (data.combo_cart.productos_sincargo) {
            htmlProductItemSinCargo = getComboListProductsFree(data.combo_cart.productos_sincargo);
            $.each(data.combo_cart.productos_sincargo, function (a, v) {
                cantProdSinCargo += v.producto.cantidad;
            });
        }

        $('#response_combocart_products').html(htmlProductItem);

        if (htmlProductItemSinCargo != "") {
            $('#response_combocart_products_free_container').show();
            $('#response_combocart_products_free').html(htmlProductItemSinCargo);
        } else {
            $('#response_combocart_products_free_container').hide();
        }

        if (data.combo_cart.regalarProducto > cantProdSinCargo) {
            $('#product_list_free').show();
            $('#product_list_buy').hide();

            if (fromaddProduct && mobilecheck() && !data.combo_cart.check_cantidad) {
                setTimeout(() => {
                    $('html,body').animate({
                        scrollTop: $("#maincontainer").offset().top
                    }, 'slow');
                }, 200);
            }
        } else {
            $('#product_list_free').hide();
            $('#product_list_buy').show();

            if (fromaddProduct && mobilecheck() && !data.combo_cart.check_cantidad) {
                setTimeout(() => {
                    $('html,body').animate({
                        scrollTop: $("#comboSideCart").offset().top
                    }, 'slow');
                }, 200);

            }
        }

        if (data.combo_cart.check_cantidad) {
            $('#comboOptions').show();
            $('#combo_list_products').hide();
            $('#comboinfol').hide();
            getComboData();
        }
        
        $('#comboproductofaltanteincart').html(msgInfoCombo);
    }
}

function getComboCart() {
    $.ajax({
        url: apiUrl,
        data: { action: 'getComboCart', id_combo: ParmComboId },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            updateComboCart(data);
        }
    }).fail(function (data) {
        //console.log("Err: " + data);
    });
}

function closeCombo() {
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'closeCombo', id_combo: ParmComboId },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            restartComboCart();

            addProductCartHeader(data.data.cart, data.data.cart_combo);
            updateCartTotal(data.data);
            window.location = 'combos';
        }

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function deleteComboCart() {
    if (confirm("esta seguro de borrar el combo?")) {
        showLoading();

        $.ajax({
            url: apiUrl,
            data: { action: 'deleteComboCart', id_combo: ParmComboId },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                restartComboCart();
            }

            showLoading(false);
        }).fail(function (data) {
            //console.log("Err: " + data);
            showLoading(false);
        });
    }
}

function restartComboCart() {
    $('#response_combocart_products').html('');
    $('#response_combocart_products_free').html('');

    $('#response_combocart_subtotal').html('$0');
    $('#response_combocart_total').html('$0');

    $('#comboatincart').html('0');
    $('#combo_list_products').hide();
    $('#combo_quantity').show();
    $('#comboOptions').hide();

    $('#product_list_free').hide();
    $('#product_list_buy').show();
}

function checkImageExists(url, callback, timeout) {
    timeout = timeout || 5000;
    var timedOut = false, timer;
    var img = new Image();
    img.onerror = img.onabort = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, "error");
        }
    };
    img.onload = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, "success");
        }
    };
    img.src = url;
    timer = setTimeout(function () {
        timedOut = true;
        callback(url, "timeout");
    }, timeout);
}

function getCombos() {
    var productsListHtml = '';

    $('#response_list_products').html(productsListHtml);

    $.ajax({
        url: apiUrl,
        data: { action: 'getCombos' },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.data != "") {
            var data_ = JSON.parse(data['data']);
            var i = 1;

            $.each(data_, function (key, val) {
                checkImageExists(val.urlImagen, function (url, result) {
                    var bgImage = url;
                    if (result == "error") {
                        bgImage = "images/default.jpg";
                    }

                    productsListHtml += '<div class="col-6 col-md-3">\
                        <div class="pitem" >\
                            <div class="photo" style="background:url('+ bgImage + ') center center / cover no-repeat;" ></div>\
                            <h3>'+ val.nombre + '</h3>\
                            <a href="javascript:;" onclick="submitComboEstatico('+val.idCombo+' )"  class="buy">Agregar Combo</a>\
                        </div>\
                    </div>';

                    if (i >= data_.length) {
                        $('#response_list_products').html(productsListHtml);
                    }

                    i++;
                })
            });
        }

        setTimeout(() => {
            $('#loadingList').hide();
        }, 1000);

        showLoading(false);
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
    });
}

function checkAgeGate() {
    let has18 = getCookie('has18');
    if (has18 != null) {
        if (has18 != "YES") {
            $('#alertmore18').show();
        }
    } else {
        $('#alertmore18').show();
    }
}

function ageGate(isOk) {
    if (isOk) {
        setCookie('has18', "YES");
        $('#alertmore18').hide();
    } else {
        setCookie('has18', "NO");
        window.location = '/';
    }
}

function listSubcategories() {
    var subcategoriesListHtml = '';

    if (subCategorias[ParmCategory] != undefined) {
        $.each(subCategorias[ParmCategory], function (ksc, vsc) {
            subcategoriesListHtml += '<div class="col-6 col-md-3">\
            <a href="productos?subcat='+ vsc.subCategoriasEcomItemID + '">\
                <div class="cpl_item">\
                    <div class="thumb"><span style="background:url('+ vsc.imagen + ') center center / contain no-repeat;"></span></div>\
                    <div class="title">'+ vsc.subCategoria + '</div>\
                </div>\
            </a>\
            </div>';
        })
    }

    $('#response_listSubcategories').html(subcategoriesListHtml);

    showLoading(false);
}

function sidebarCategorias() {
    var sidebarHtml = '';
    $.each(categorias, function (key, val) {
        sidebarHtml += '<li>\
            <a href="#" class="hassubmenu">'+ val.categoria + ' <span>+</span></a>\
            <ul>';

        if (subCategorias[val.categoriaID] != undefined) {
            $.each(subCategorias[val.categoriaID], function (ksc, vsc) {
                sidebarHtml += '<li><a href="productos?subcat=' + vsc.subCategoriasEcomItemID + '">' + vsc.subCategoria + '</a></li>';

                if (ParmSubCategory && ParmSubCategory == vsc.subCategoriasEcomItemID) {
                    ParmCategory = val.categoriaID;
                }
            });
        }

        sidebarHtml += '</ul>';
        sidebarHtml += '</li>';
    });

    sidebarHtml += '<li><a href="productos?subcat=1002" >LO MAS PEDIDO</a></li>';
    sidebarHtml += '<li><a href="productos?subcat=1003" >NUEVOS INGRESOS</a></li>';

    $('#response_categorias_sidebar').html(sidebarHtml);

    eventMenuSidebar();
}

function eventMenuSidebar() {
    $("#sidebar .sbmenu > li > a.hassubmenu").click(function (e) {
        if ($(this).find("span").text() == "+") {
            $(this).find("span").text("-")
            $(this).next().addClass("active");
        } else {
            $(this).find("span").text("+")
            $(this).next().removeClass("active");
        }

        e.preventDefault();
    })
}

function eventMenuHeader() {
    $("header #categories ul.menu li a.hasmenu").click(function (e) {
        var link = $(this);
        var submenu = $(this).attr("href");

        $("header #categories ul.menu li a").removeClass("active");
        $("header #categories .submenus").css("display", "none");

        if (!(link.hasClass("active"))) {
            link.addClass("active");
            $("header #categories .submenus").css("display", "inline-block")
        }

        $("header #categories .submenus ul").hide()
        $(submenu).show()

        e.preventDefault();
    })
}

/******************************************************************* USUARIOS *******************************************************************/
function registerUser(form_) {
    $.ajax({
        url: apiUrl,
        data: {
            action: 'register_user', tipo_usuario: form_.tipo_usuario.value, email: form_.email.value,
            password: form_.password.value, nombre: form_.nombre.value, apellido: form_.apellido.value,
            direccion: form_.direccion_envio.value, dni: form_.dni.value, direccion_envio: form_.direccion_envio.value,
            direccion_envio_lat: form_.reg_lat.value, direccion_envio_lng: form_.reg_lng.value, telefono: form_.telefono.value, referido: form_.referido.value
        },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            setCookie('tipoUsuario', form_.tipo_usuario.value);
            location.reload();
        }

        return false;
    }).fail(function (data) {
        //console.log("Err: " + data);
        return false;
    });

    return false;
}

function registerUserAPP(form_) {
    showLoading(true);

    $.ajax({
        url: apiUrl,
        data: {
            action: 'register_userAPP', 
                tipo_usuario: form_.registro_tipo_usuario.value, 
                email: form_.email.value,
                password: form_.password.value, 
                nombre: form_.nombre.value, 
                dni: form_.dni.value, 
                direccionenvio: form_.direccion_envio.value,
                direccionenvio_codigopostal: form_.codigopostal.value,
                //direccionenvio_latitud: form_.reg_lat.value, 
                //direccionenvio_longitud: form_.reg_lng.value, 
                provincia: form_.provincia.options[provincia.selectedIndex].text, 
                localidad: form_.localidad.options[localidad.selectedIndex].text, 
                telefono: form_.telefono.value
        },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        console.log(data.jsonPostData);
        swal(data.message);
        document.getElementById("formaltaapp").reset();
        showLoading(false);
    }).fail(function (data) {
        console.log("Err: " + data);
        showLoading(false);
    });

    return false;
}

function updateUser(form_) {
    showLoading();

    if (isChangedShippingAdress) {
        swal('Atencion', 'Se ha detectado un cambio en la direcciÃ³n de envÃ­o, pero parece estar erronea, por favor verificala', 'warning');
        showLoading(false);
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'update_user', password: form_.password.value, direccion_envio: form_.direccion_envio.value, nombre: form_.nombre.value, apellido: form_.apellido.value, direccion: form_.direccion_envio.value, dni: form_.dni.value, adicional_envio: form_.adicional_envio.value, direccion: form_.direccion.value, telefono: form_.telefono.value, },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                swal('Datos Actualizados', '', 'success');
            }
            showLoading(false);
            return false;
        }).fail(function (data) {
            showLoading(false);
            //console.log("Err: " + data);
            return false;
        });
    }

    return false;
}

function forgot_password() {
    email_ = $('#forgot_password_email').val();
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'forgot_password', email: email_ },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        showAlert(data.message);
        $('#forgot_password_email').val('');
        showLoading(false);
        return false;
    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);
        return false;
    });

    return false;
}

function changeToForgotPass(isforgot = true) {
    if (isforgot) {
        $('#forgotpassbox').show();
        $('#loginbox').hide();
    } else {
        $('#forgotpassbox').hide();
        $('#loginbox').show();
    }
}

function loginUser(form_) {
    showLoading(true);

    $.ajax({
        url: apiUrl,
        data: { action: 'login_user', email: form_.email.value, password: form_.password.value },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal(data.message, "", "warning");
            showLoading(false);
        } else {
            setCookie('tipoUsuario', data.user_data.tipo_usuario);
            setCookie('showNL', 'OK');
            setCookie('usrid', data.user_data.id, 30);
            setCookie('usridp', data.user_data.password, 30);
            setCookie('mail', data.user_data.email, 30);
            location.reload();
        }
        return false;
    }).fail(function (data) {
        showLoading(false);
        //console.log("Err: " + data);

        return false;
    });

    return false;
}

function showNewsletterPopup() {
    $('#panel_newsletter').addClass("active");
}

function showShippingAddressPopup() {
    showLoading(true);
    $.ajax({
        url: apiUrl,
        data: { action: 'getUserData' },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            $('#input_shipping_address').val(data.user_data.direccion_envio);
        }

        showLoading(false);
        return false;
    }).fail(function (data) {
        //console.log("Err: " + data);
        showLoading(false);
        return false;
    });

    $('#panel_shipping_address').addClass("active");
}

function shippingAddressRegister() {
    const map = new google.maps.Map(document.getElementById("shipping_address_map"), {
        center: { lat: -34.731706, lng: -58.330954 },
        zoom: 15,
        disableDefaultUI: true,
    });

    const marker = new google.maps.Marker({
        position: { lat: -34.731706, lng: -58.330954 },
        map,
        anchorPoint: new google.maps.Point(0, -29),
    });
}

function onchangeshipping_address_input() {
    isChangedShippingAdress = false;
}

function checkout() {
    showLoading(true);

    //agregado para validar zona
    $.ajax({
        type: "POST",
        url: "./validarzona",
        data: {},
        success: function (data) {
            // alert(data);
        }
    });

    if (isChangedShippingAdress) {
        swal('Atencion', 'Se ha detectado un cambio en la direcciÃ³n de envÃ­o, pero parece estar erronea, por favor verificala', 'warning');
        showLoading(false);
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getUserData' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                showAlert(data.message);
                showLoading(false);
            } else {
                if (data.user_data.direccion_envio != null) {
                    if (data.user_data.direccion_envio_lat == "" || data.user_data.direccion_envio_lat == "null") {
                        swal('Verifica tu direcciÃ³n de envÃ­o', '', 'warning');
                        showLoading(false);
                        //agregado para validar zona
                    } else if (data.user_data.en_zona != 1) {
                        swal('Atencion', 'La direccion ingresada esta fuera de nuestra zona de cobertura.', 'warning');
                        showLoading(false);
                    } else if ((iserrorTelefono || data.user_data.telefono.length != 10) && data.user_data.tipo_usuario != "3") {
                        swal('Telefono incorrecto', 'Ingrese su nr de celular para recibir el seguimiento de su compra.  Codigo de area+numero de telefono, sin 0 ni 15. Ej 1144443333  2214445555', 'error');
                        showLoading(false);
                    } else {
                        $.ajax({
                            url: apiUrl,
                            data: { action: 'checkMminAmount', adicional_envio: $('#adicional_envio').val() },
                            dataType: 'json',
                            method: 'post'
                        }).done(function (data) {
                            //console.log(data);
                            if (data.state == 'error') {
                                showLoading(false);
                                swal("", data.message.replaceAll('-nn', '\n'), "warning");
                            } else {
                                //Envia a MercadoPago
                                window.location = 'mpredir';
                            }
                        }).fail(function (data) {
                            console.log("Err: " + data);
                            showLoading(false);
                        });
                    }
                } else {
                    showAlert('Ingresa una direcciÃ³n de envÃ­o');
                    showLoading(false);
                }
            }
        }).fail(function (data) {
            console.log("Err: " + data);
            showLoading(false);
            return false;
        });
    }
}

function hideNewsletter() {
    setCookie('showNL', 'OK');
    $('#panel_newsletter').removeClass("active");
}

function hidePopup(popupId) {
    $(popupId).removeClass("active");
}

function subscribeNewsletter(form_) {
    if (form_.email.value == "") {
        showAlert("Ingresa una direccion de corre valida");
    } else {
        showLoading();

        $.ajax({
            url: apiUrl,
            data: { action: 'subscribeNewsletter', email: form_.email.value },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            //console.log(data);
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                showAlert(data.message);
                hideNewsletter();
            }
            showLoading(false);
            return false;
        }).fail(function (data) {
            console.log("Err: " + data);
            showLoading(false);
            return false;
        });
    }

    return false;
}

function submitShippingAddress(form_) {
    if (form_.input_shipping_address.value == "") {
        showAlert("Ingresa una direccion de corre valida");
    } else {
        showLoading();

        $.ajax({
            url: apiUrl,
            data: { action: 'submitShippingAddress', shipping_address: form_.input_shipping_address.value },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            //console.log(data);
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                $('#panel_shipping_address').removeClass("active");
                $('#user_shipping_address').html(form_.input_shipping_address.value);
            }
            showLoading(false);
            return false;
        }).fail(function (data) {
            console.log("Err: " + data);
            showLoading(false);
            return false;
        });
    }

    return false;
}

var onloadCallback = function () {
    renderReCaptcha()
};

function renderReCaptcha() {
    if (window.grecaptcha.render == null) {
        later(() => {
            this.renderReCaptcha();
        }, 500);
    } else {
        window.grecaptcha.render('html_element', {
            'sitekey': '6Lf-098ZAAAAAJyqarb9zR3_QncwZxgvgNEJakxm'
        });
    }
}

function showContact() {
    $('#panel_contacto').addClass("active");
}

function submitContact(form_) {
    if (false) {
        showAlert("verifique captcha");
        return false;
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'submitContact', nombre: form_.nombre.value, email: form_.email.value, content: form_.content.value },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            //console.log(data);
            if (data.state == 'error') {
                showAlert(data.message);
            } else {
                swal((data.message), "", "success");
                $('#panel_contacto').removeClass("active");
            }

            $('#contactSubmitBtn').show();
            form_.email.value = "";
            form_.content.value = "";

            return false;
        }).fail(function (data) {
            console.log("Err: " + data);

            return false;
        });
    }

    return false;
}

function changePassword() {
    return false;
}

function logout() {
    showLoading(true);
    $.ajax({
        url: apiUrl,
        data: { action: 'logout_user' },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showLoading(true);
            showAlert(data.message);
        } else {
            eraseCookie('tipoUsuario');
            eraseCookie('usrid');
            eraseCookie('usridp');
            eraseCookie('mail');

            location.reload();
        }
        return false;
    }).fail(function (data) {
        showLoading(false);
        console.log("Err: " + data);

        return false;
    });

    return false;
}

/****************************************************** MAPAS **********************************************************************/
function initMap() {
    var input = document.getElementById('searchgmaps');
    const autocomplete = new google.maps.places.Autocomplete(input);

    initMapCheckoutShippingAddress(function (data) {
        checkoutShippingAddress(data.shipping_address_data);
    });
}

function initMapCheckoutShippingAddress(callback) {
    $.ajax({
        url: apiUrl,
        data: {
            action: 'getShippingAddressData'
        },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            if (callback) { callback(data); }
        }
    }).fail(function (data) {
        console.log("Err: " + data);
        showLoading(false);
    });
}

function checkoutShippingAddress(shipping_data, inputField = 'shipping_address_input', mapField = 'shipping_address_map', forsubmit = true) {
    var map_id = document.getElementById(mapField);

    if (map_id) {
        const map = new google.maps.Map(map_id, {
            center: { lat: parseFloat(shipping_data.direccion_envio_lat), lng: parseFloat(shipping_data.direccion_envio_lng) },
            zoom: 15,
            disableDefaultUI: true,
        });

        const input_sai = document.getElementById(inputField);
        const autocomplete_sai = new google.maps.places.Autocomplete(input_sai);
        autocomplete_sai.bindTo("bounds", map);

        const marker = new google.maps.Marker({
            position: { lat: parseFloat(shipping_data.direccion_envio_lat), lng: parseFloat(shipping_data.direccion_envio_lng) },
            map,
            anchorPoint: new google.maps.Point(0, -29),
        });

        if (!shipping_data.show_marker) { marker.setVisible(false); }

        autocomplete_sai.addListener("place_changed", () => {
            $('#' + mapField).addClass('visible');

            marker.setVisible(false);

            const place = autocomplete_sai.getPlace();

            if (!place.geometry) {
                window.alert("No details available for input: '" + place.name + "'");
                return;
            }

            if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
            } else {
                map.setCenter(place.geometry.location);
                map.setZoom(15);
            }

            marker.setPosition(place.geometry.location);
            marker.setVisible(true);

            if (forsubmit) {
                updateShippingAddress(input_sai, place.geometry.location.lat(), place.geometry.location.lng(), map);
            } else {
                $('#reg_lat').val(place.geometry.location.lat());
                $('#reg_lng').val(place.geometry.location.lng());
            }
        });
    }
}

function updateShippingAddress(input, lat, lng, map) {
    $.ajax({
        url: apiUrl,
        data: {
            action: 'submitShippingAddress',
            shipping_address: input.value,
            shipping_address_lat: lat,
            shipping_address_lng: lng
        },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            showAlert(data.message);
        } else {
            swal("DirecciÃ³n de envÃ­o actualizada.", "", "success");
            isChangedShippingAdress = false;

            if (!$("#shipping_address_map").hasClass("active")) {
                $("#shipping_address_map").addClass("active");
                setTimeout(function () { map.setZoom(15); }, 500)
            }
        }
    }).fail(function (data) {
        showLoading(false);
    });
}

function addToWishList() {
    $.ajax({
        url: apiUrl,
        data: { action: 'addToWishList', producto_id: actualProduct.productosID },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.isLogin) {
            if (data.active) {
                $('#wishlist').addClass('active');
            } else {
                $('#wishlist').removeClass('active');
            }
        } else {
            showAlert("Debes loguearte para agregar productos a tu lista de deseados");
        }
    }).fail(function (data) {
        console.log("Err: " + data);
    });
}

function close_header_cart() {
    $('#panel_header_cart').removeClass('active');
}

//search box
function searchProducts() {
    console.log($('#searchInput').val());
}

//on keyup, start the countdown
$searchInput.on('keyup', function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(doneTyping, doneTypingInterval);
});

//on keydown, clear the countdown 
$searchInput.on('keydown', function () {
    clearTimeout(typingTimer);
});

function doneTyping() {
    if ($('#searchInput').val().length >= 3) {
        listProducts('getSearch');
        $('#product_category_car').hide();
    }
}

function doneTyping_ori() {
    setTimeout(() => {
        $.ajax({
            url: apiUrl,
            data: { action: 'searchSuggest', inputvalue: $('#searchInput').val() },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            var htmlSS = '';

            $.each(data.data, function (a, v) {
                htmlSS += '<li><a href="busqueda?buscar=' + v.valor + '">' + v.valor + '</a></li>';
            });

            $('#searchSuggest').html(htmlSS);
        }).fail(function (data) {
            console.log("Err: " + data);
        });
    }, 1000);
}

function fueradezona() {
    alert("fuera de zona");
}

function showAlert(error_) {
    alert(error_);
}

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    var toreturn_ = "";

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            toreturn_ = sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }

    //console.log("getUrlParameter: " + sParam + " - " + toreturn_);
    return toreturn_;
};

function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = name + '=; Max-Age=-99999999;';
}

window.mobilecheck = function () {
    var check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

function onchangetelefono_input(nrtel) {
    if (isNaN(nrtel.value) || nrtel.value.length != 10) { //si no es numero error
        swal("Telefono incorrecto", "Ingrese su nr de celular para recibir el seguimiento de su compra.  Codigo de area+numero de telefono, sin 0 ni 15. Ej 1144443333  2214445555", "error");
        iserrorTelefono = true;
        return false;
    } else {
        //si es valido continua aca
        $.ajax({
            url: apiUrl,
            data: { action: 'update_tel', telefono: nrtel.value, },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            if (data.state == 'error') {
                swal("error.1..");
            } else {
                var nrtelcompleto = '549' + nrtel.value;

                //envia whatsapp
                $.ajax({
                    url: apiUrl,
                    data: { action: 'send_wa', Telefono: nrtelcompleto, htmlMensaje: 'Queres recibir nuestras ofertas exclusivas por aqui?.  Gracias por elegirnos. Distrisuronline.com.   ', urlImagen: '', Titulo: '' },
                    dataType: 'json',
                    method: 'post'
                }).done(function (data) {
                    swal("Te enviamos un Whatsapp al " + nrtel.value, "Te mantendremos  actualizado del estado de tu compra", "success");
                    iserrorTelefono = false;
                }).fail(function (data) {
                    //swal("whats error "+nrtel.value)
                });
            }

            showLoading(false);
            return false;
        }).fail(function (data) {
            console.log("Err: " + data);
            showLoading(false);
            return false;
        });
    }
};

function onchangedni_input(dni) {
    if (isNaN(dni.value) || dni.value.length < 7 || dni.value.length > 11) { //si no es numero error
        swal("DNI o CUIT invalido", '', "error");
        iserrorDni = true;
        return false;
    }
};

function solicitarcf(cf) {
    $tfact = cf.value;
    $.ajax({
        url: apiUrl,
        data: { action: 'update_cf', CF: $tfact },
        dataType: 'json',
        method: 'post'
    });
    location.reload();
};

function fechadeentrega(fecha) {
    var fechas = JSON.parse(fecha.value);
    setCookie("Fechadeentrega", fechas.Fechadeentrega);
    setCookie("FechadeAsignacion", fechas.FechadeAsignacion);

    $.ajax({
        url: apiUrl,
        data: { action: 'update_fechadeentrega', fecha: fechas.FechadeAsignacion },
        dataType: 'json',
        method: 'post'
    });
};

function check_giftcard(GCcode) {
    $.ajax({
        url: apiUrl,
        data: { action: 'checkgift', giftcode: GCcode, },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal("error.1..");
        } else {
            //  if(data.error)
            //  alert(data);
            //var nrtelcompleto = '549'+nrtel.value;
        }
    })

    location.reload();
}

function selectOrder(o) {
    tipoDeOrden = o.value;
    setCookie('tipoDeOrden', tipoDeOrden);
    location.reload();
}

function filtroMarca(o) {
    filtroMar = o.value;
    if (filtroMar == 9999) {
        eraseCookie('filtroMarca');
    } else {
        setCookie('filtroMarca', filtroMar);
    }
    
    location.reload();
}

function delete_cart_sql() {
    showLoading();
    $.ajax({
        url: apiUrl,
        data: { action: 'delete_cart_sql' },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        showLoading(false);
        return false;
    }).fail(function (data) {
        console.log("Err: " + data);
        return false;
    });
}

function restore_cart_sql(cart) {
    for (var proditem in cart) {
        var pid = cart[proditem][2];
        var cant = cart[proditem][3];
        addProductToCart(pid, cant);
    }
}

function ShowAddModalDesktop() {
    let showADD = getCookie('showADD');
    if (showADD == null) {
        setTimeout(() => {
            $('#ModalAdd').modal('show');
            $(".btnadd").click(function () {
                $("#ModalAdd").modal('hide');
            });

            $('body').on('click', function (event) {
                $("#ModalAdd").modal('hide');
            });

        }, 1000);
        setCookie('showADD', 'OK');
    }
}

function ShowAddModalMobile() {
    let showADD = getCookie('showADD');

    if (showADD == null) {
        setTimeout(() => {
            $('#ModalAddMobile').modal('show');
            $(".btnadd").click(function () {
                $("#ModalAddMobile").modal('hide');
            });
            $('body').on('click', function (event) {
                $("#ModalAddMobile").modal('hide');
            });
        }, 1000);
        setCookie('showADD', 'OK');
    }
}

function showImbatibles_post(data_) {
    var userType = getCookie('tipoUsuario');

    productsListHtml = '';
    //console.log(data_);

    if (data_.lsProductos.length > 0) {
        $.each(data_.lsProductos, function (key, val) {
            if (userType == 3) {
                listaaUsar = val.precioActual4;
                precioxunidad = (listaaUsar / val.uxBReal).toFixed(2);
            } else {
                listaaUsar = val.precioActual1;
                precioxunidad = (val.precioActual2 / val.uxBReal).toFixed(2);
            }

            let marca_ = findMarca(val.marcaId);

            if (val.precioAnterior1 != "" && userType != 3) {
                descuentoBox = '<div class="percent">' + val.precioAnterior1 + '</div>';
                descuentoBox += '<span class="percent">$' + val.precioActual2 + '</span>';
            }

            htmlBotonAgregar = '<div> <p class="qtyproduct"> <a href="javascript:;" onclick="addtocartModal(' + val.productosID + ')" class="buy">Comprar</a></p></div>';

            productsListHtml += '<div class="pitem " >\
                <div class="pitemInner" onclick="addtocartModal('+ val.productosID + ')">\
                    <div class="photo" style="background:url(images/img_imbatibles_front.gif)  center center / cover no-repeat, url('+ val.imagen + ') center center / cover no-repeat,url(images/img_imbatibles_back.jpg)  center center / cover no-repeat ;" ></div>\
                    <h3>'+ val.descripcion + '</h3>\
                    <h4>'+ marca_ + '</h4>\
                    <div class="nopercent"> $'+ precioxunidad + ' x Un.</div>\
                    </div>\
            </div>';
        });

        $('#loadingImbatibles').hide();

        $('#response_imbatibles').html(productsListHtml);
        //console.log(productsListHtml);

        //create carrousel..
        let isCarouselLoop = false;
        if (mobilecheck() || data_.length > 4) {
            isCarouselLoop = true;
        }

        setTimeout(() => {
            $('.home_owl-carouselIMResponse').owlCarousel({
                center: false,
                loop: isCarouselLoop,
                margin: 40,
                responsiveClass: true,
                dots: false,
                responsive: {
                    0: {
                        items: 1,
                        nav: true
                    },
                    768: {
                        items: 5,
                        nav: true
                    },
                    1000: {
                        items: 5,
                        nav: true
                    }
                }
            })
        }, 500);

    } else {
        $('#response_imbatibles').hide();
    }
}

function showImbatibles() {
    var imbatibles = sessionStorage.getItem('imbatibles');
    var ti = Date.now() - getCookie('imbatibles_time');

    if (imbatibles != null && ti < time_cache) {
        showImbatibles_post(JSON.parse(imbatibles));
    } else {
        $.ajax({
            url: apiUrl,
            data: { action: 'getImbatibles' },
            dataType: 'json',
            method: 'post'
        }).done(function (data) {
            var data_ = data['data'];

            showImbatibles_post(data_);

            sessionStorage.setItem('imbatibles', JSON.stringify(data_));
            setCookie('imbatibles_time', Date.now());
        }).fail(function (data) {
            console.log("Err: " + data);
        });
    }
}

function loginUserCookie(em, p) {
    showLoading();

    $.ajax({
        url: apiUrl,
        data: { action: 'login_user', email: em, password: p, cookie: 1 },
        dataType: 'json',
        method: 'post'
    }).done(function (data) {
        if (data.state == 'error') {
            swal(data.message, "", "warning");
            showLoading(false);
        } else {
            setCookie('tipoUsuario', data.user_data.tipo_usuario);
            setCookie('showNL', 'OK');
            setCookie('usrid', data.user_data.id, 30);
            setCookie('usridp', data.user_data.password, 30);
            setCookie('mail', data.user_data.email, 30);
            location.reload();
        }
        return false;
    }).fail(function (data) {
        console.log("Err: " + data);
        showLoading(false);

        return false;
    });

    return false;
}


