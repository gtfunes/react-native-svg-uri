import React, { Component } from "react";
import { View } from "react-native";
import PropTypes from "prop-types";
import xmldom from "xmldom";
import AsyncStorage from "@react-native-community/async-storage";
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";

import Svg, {
  Circle,
  Ellipse,
  G,
  LinearGradient,
  RadialGradient,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text,
  TSpan,
  Defs,
  Use,
  Stop,
} from "react-native-svg";

const ACCEPTED_SVG_ELEMENTS = [
  "svg",
  "g",
  "circle",
  "path",
  "rect",
  "defs",
  "use",
  "line",
  "linearGradient",
  "radialGradient",
  "stop",
  "ellipse",
  "polygon",
  "polyline",
  "text",
  "tspan",
];

// Attributes from SVG elements that are mapped directly
const SVG_ATTS = ["viewBox", "width", "height"];
const G_ATTS = ["id", "display"];

const CIRCLE_ATTS = ["cx", "cy", "r"];
const PATH_ATTS = ["d", "fillRule", "clipRule"];
const RECT_ATTS = ["width", "height"];
const LINE_ATTS = ["x1", "y1", "x2", "y2"];
const LINEARG_ATTS = LINE_ATTS.concat(["id", "gradientUnits"]);
const RADIALG_ATTS = CIRCLE_ATTS.concat(["id", "gradientUnits"]);
const USE_ATTS = ["href", "x", "y"];
const STOP_ATTS = ["offset"];
const ELLIPSE_ATTS = ["cx", "cy", "rx", "ry"];

const TEXT_ATTS = ["fontFamily", "fontSize", "fontWeight", "textAnchor"];

const POLYGON_ATTS = ["points"];
const POLYLINE_ATTS = ["points"];

const COMMON_ATTS = [
  "id",
  "fill",
  "fillOpacity",
  "stroke",
  "strokeWidth",
  "strokeOpacity",
  "opacity",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "strokeDashoffset",
  "x",
  "y",
  "rotate",
  "scale",
  "origin",
  "originX",
  "originY",
  "transform",
  "clipPath",
];

const camelCase = (value) =>
  value.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

const camelCaseNodeName = ({ localName, nodeValue }) => ({
  localName: camelCase(localName),
  nodeValue,
});

const removePixelsFromNodeValue = ({ localName, nodeValue }) => ({
  localName,
  nodeValue: nodeValue.replace("px", ""),
});

const transformStyle = ({ localName, nodeValue, fillProp }) => {
  if (localName === "style") {
    return nodeValue.split(";").reduce((acc, attribute) => {
      const [property, value] = attribute.split(":");
      if (property == "") return acc;
      else
        return {
          ...acc,
          [camelCase(property)]:
            fillProp && property === "fill" ? fillProp : value,
        };
    }, {});
  }
  return null;
};

const getEnabledAttributes = (enabledAttributes) => ({ localName }) =>
  enabledAttributes.includes(camelCase(localName));

const fixYPosition = (y, node) => {
  if (node.attributes) {
    const fontSizeAttr = Object.keys(node.attributes).find(
      (a) => node.attributes[a].name === "font-size"
    );
    if (fontSizeAttr) {
      return (
        "" + (parseFloat(y) - parseFloat(node.attributes[fontSizeAttr].value))
      );
    }
  }
  if (!node.parentNode) {
    return y;
  }
  return fixYPosition(y, node.parentNode);
};

const trimElementChilden = (children) => {
  for (const child of children) {
    if (typeof child === "string") {
      if (child.trim().length === 0)
        children.splice(children.indexOf(child), 1);
    }
  }
};

class SvgUri extends Component {
  elementIndex = 0;

  constructor(props) {
    super(props);

    this.state = { fill: props.fill, svgXmlData: props.svgXmlData };

    this.isComponentMounted = false;

    // Gets the image data from an URL or a static file
    if (props.source) {
      const source = resolveAssetSource(props.source) || {};
      this.fetchSVGData(source.uri);
    }
  }

  componentWillMount() {
    this.isComponentMounted = true;
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.source) {
      const source = resolveAssetSource(nextProps.source) || {};
      const oldSource = resolveAssetSource(this.props.source) || {};
      if (source.uri !== oldSource.uri) {
        this.fetchSVGData(source.uri);
      }
    }

    if (nextProps.svgXmlData !== this.props.svgXmlData) {
      this.setState({ svgXmlData: nextProps.svgXmlData });
    }

    if (nextProps.fill !== this.props.fill) {
      this.setState({ fill: nextProps.fill });
    }
  }

  componentWillUnmount() {
    this.isComponentMounted = false;
  }

  fetchSVGData = async (uri) => {
    let responseXML = null,
      error = null;
    try {
      const value = await AsyncStorage.getItem(uri);
      if (value) {
        responseXML = value;
      } else {
        const response = await fetch(uri);
        responseXML = await response.text();
        if (!this.props.noCache) AsyncStorage.setItem(uri, responseXML);
      }
    } catch (e) {
      error = e;

      const { onError } = this.props;
      if (onError) {
        onError(e);
      }
    } finally {
      if (this.isComponentMounted) {
        this.setState({ svgXmlData: responseXML }, () => {
          const { onLoad } = this.props;
          if (onLoad && !error) {
            onLoad();
          }
        });
      }
    }

    return responseXML;
  };

  createSVGElement = (node, childs) => {
    trimElementChilden(childs);

    let componentAtts = {};
    const key = this.elementIndex++;

    switch (node.localName) {
      case "svg":
        componentAtts = this.obtainComponentAtts(node, SVG_ATTS);
        if (this.props.width) {
          componentAtts.width = this.props.width;
        }
        if (this.props.height) {
          componentAtts.height = this.props.height;
        }

        return (
          <Svg key={key} {...componentAtts}>
            {childs}
          </Svg>
        );
      case "g":
        componentAtts = this.obtainComponentAtts(node, G_ATTS);
        return (
          <G key={key} {...componentAtts}>
            {childs}
          </G>
        );
      case "path":
        componentAtts = this.obtainComponentAtts(node, PATH_ATTS);
        return (
          <Path key={key} {...componentAtts}>
            {childs}
          </Path>
        );
      case "circle":
        componentAtts = this.obtainComponentAtts(node, CIRCLE_ATTS);
        return (
          <Circle key={key} {...componentAtts}>
            {childs}
          </Circle>
        );
      case "rect":
        componentAtts = this.obtainComponentAtts(node, RECT_ATTS);
        return (
          <Rect key={key} {...componentAtts}>
            {childs}
          </Rect>
        );
      case "line":
        componentAtts = this.obtainComponentAtts(node, LINE_ATTS);
        return (
          <Line key={key} {...componentAtts}>
            {childs}
          </Line>
        );
      case "defs":
        return <Defs key={key}>{childs}</Defs>;
      case "use":
        componentAtts = this.obtainComponentAtts(node, USE_ATTS);
        return (
          <Use key={key} {...componentAtts}>
            {childs}
          </Use>
        );
      case "linearGradient":
        componentAtts = this.obtainComponentAtts(node, LINEARG_ATTS);
        return (
          <LinearGradient key={key} {...componentAtts}>
            {childs}
          </LinearGradient>
        );
      case "radialGradient":
        componentAtts = this.obtainComponentAtts(node, RADIALG_ATTS);
        return (
          <RadialGradient key={key} {...componentAtts}>
            {childs}
          </RadialGradient>
        );
      case "stop":
        componentAtts = this.obtainComponentAtts(node, STOP_ATTS);
        return (
          <Stop key={key} {...componentAtts}>
            {childs}
          </Stop>
        );
      case "ellipse":
        componentAtts = this.obtainComponentAtts(node, ELLIPSE_ATTS);
        return (
          <Ellipse key={key} {...componentAtts}>
            {childs}
          </Ellipse>
        );
      case "polygon":
        componentAtts = this.obtainComponentAtts(node, POLYGON_ATTS);
        return (
          <Polygon key={key} {...componentAtts}>
            {childs}
          </Polygon>
        );
      case "polyline":
        componentAtts = this.obtainComponentAtts(node, POLYLINE_ATTS);
        return (
          <Polyline key={key} {...componentAtts}>
            {childs}
          </Polyline>
        );
      case "text":
        componentAtts = this.obtainComponentAtts(node, TEXT_ATTS);
        return (
          <Text key={key} {...componentAtts}>
            {childs}
          </Text>
        );
      case "tspan":
        componentAtts = this.obtainComponentAtts(node, TEXT_ATTS);
        if (componentAtts.y) {
          componentAtts.y = fixYPosition(componentAtts.y, node);
        }
        return (
          <TSpan key={key} {...componentAtts}>
            {childs}
          </TSpan>
        );
      default:
        return null;
    }
  };

  obtainComponentAtts = ({ attributes }, enabledAttributes) => {
    const styleAtts = {};

    if (this.state.fill && this.props.fillAll) {
      styleAtts.fill = this.state.fill;
    }

    Array.from(attributes).forEach(({ localName, nodeValue }) => {
      Object.assign(
        styleAtts,
        transformStyle({
          localName,
          nodeValue,
          fillProp: this.state.fill,
        })
      );
    });

    const componentAtts = Array.from(attributes)
      .map(camelCaseNodeName)
      .map(removePixelsFromNodeValue)
      .filter(getEnabledAttributes(enabledAttributes.concat(COMMON_ATTS)))
      .reduce((acc, { localName, nodeValue }) => {
        acc[localName] =
          this.state.fill && localName === "fill" && nodeValue !== "none"
            ? this.state.fill
            : nodeValue;
        return acc;
      }, {});
    Object.assign(componentAtts, styleAtts);

    return componentAtts;
  };

  getValidChildNodes = (node) => {
    if (!node.firstChild) {
      return null;
    }

    const arrayElements = [];

    for (let i = 0; i < node.childNodes.length; i++) {
      const childNode = node.childNodes[i];

      if (ACCEPTED_SVG_ELEMENTS.includes(childNode.localName)) {
        arrayElements.push(childNode);
      }
    }

    return arrayElements;
  };

  inspectNode = (node) => {
    const nodeName = node.localName;

    // We only process supported elements
    // Except when the item is a switch, as we may
    // support any of its child elements
    if (!ACCEPTED_SVG_ELEMENTS.includes(nodeName)) {
      if (nodeName !== "switch") {
        return null;
      }

      const acceptedChildren = this.getValidChildNodes(node);

      if (acceptedChildren && acceptedChildren.length) {
        let nodeToRender = null;
        acceptedChildren.every((childNode) => {
          const nodeView = this.inspectNode(childNode);
          nodeToRender = nodeView;
          return nodeView === null;
        });

        return nodeToRender;
      }
    }

    const arrayElements = [];

    // If we have children on this xml node, process them
    if (node.firstChild) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const childNode = node.childNodes[i];
        const textValue = childNode.nodeValue;

        if (textValue) {
          arrayElements.push(textValue);
        } else {
          const granChildNodes = this.inspectNode(childNode);

          if (granChildNodes) {
            arrayElements.push(granChildNodes);
          }
        }
      }
    }

    return this.createSVGElement(node, arrayElements);
  };

  render() {
    try {
      if (this.state.svgXmlData == null) {
        return null;
      }

      const inputSVG = this.state.svgXmlData
        .substring(
          this.state.svgXmlData.indexOf("<svg "),
          this.state.svgXmlData.indexOf("</svg>") + 6
        )
        .replace(/<!-(.*?)->/g, "");

      const doc = new xmldom.DOMParser().parseFromString(inputSVG);

      const rootSVG = this.inspectNode(doc.firstChild);

      return <View style={this.props.style}>{rootSVG}</View>;
    } catch (e) {
      const { onError } = this.props;
      if (onError) {
        onError(e);
      }

      return null;
    }
  }
}

SvgUri.propTypes = {
  style: PropTypes.object,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  svgXmlData: PropTypes.string,
  source: PropTypes.any,
  fill: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  fillAll: PropTypes.bool,
  noCache: PropTypes.bool,
};

export default SvgUri;
